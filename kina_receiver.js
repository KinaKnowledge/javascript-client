/**
 * Kina Receiver - Connects with the Kina server to enable download of ready files and information.
 *                 Optionally can unzip and run a callback function for each received transaction
 *                 for post-receipt processing.
 *
 * (c) 2017 Kina, LLC
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 *
 */

const http = require('http');
const net = require('net');
const fs = require('fs');
const url = require('url');
const os = require('os');
const path = require('path');
const temp = require('temp');
const mime = require('mime');
const request = require('request');
var mkdirp = require('mkdirp');
const https = require('https');
const zip = require('node-zip');

const zl=require ('./zip_list_entry');


function Receiver(kinaConnection, name, groupingID, directory, packagingProfileName, credentials) {

    this.receiveDirectory=directory;
    this.name=name;
    this.groupingID=groupingID;
    this.credentials=credentials;
    this.kinaConnection = kinaConnection;
    this.packagingProfile = packagingProfileName;
    this.busy=true;
    this.moreAvailable=false;
    this.readyTransactions=[];
    this.packagingJSON=null;
    this.receivedFilesForSpool={};
    this.receivedCount = 0;
    this.errorCount = 0;

    var stat = fs.lstatSync(this.receiveDirectory);
    if (stat==null) {
        throw "invalid receive directory: "+this.receiveDirectory;
    }

    var self=this;

    this.kinaConnection.serverRequest('/packaging_templates',{},
        function(data) {
            self.busy=false;
            if (data.rval=='OK') {

                for (var i = 0; i < data.templates.length; i++) {
                    var template = data.templates[i];
                    if (template.name==self.packagingProfile) {
                        self.packagingJSON=template;
                    }
                }
                if (self.packagingJSON==null) {
                    throw "Invalid packaging profile identified: "+self.packagingProfile;
                } else {
                    self.kinaConnection.log(self.name+": received packaging profile details for "+self.packagingProfile);
                }
            }
        },
        function(error) {
            self.busy=false;
            throw error;
        },'get');

    this.log("listening on grouping ID:"+this.groupingID+": mapped to "+this.receiveDirectory);

}

Receiver.prototype.addReceivedFileForSpool=function(spoolfile,file) {
    console.log(spoolfile+": creating receive file array");
    if (this.receivedFilesForSpool[spoolfile]==undefined) {
        this.receivedFilesForSpool[spoolfile]=[];
    }
    this.receivedFilesForSpool[spoolfile].push(file);
};

Receiver.prototype.getReceivedFileForSpool=function(spoolfile,index) {
    console.log(spoolfile+": getting file at index: "+index+": "+this.receivedFilesForSpool[spoolfile][index]);
    return this.receivedFilesForSpool[spoolfile][index];
};

Receiver.prototype.getReceivedSpoolLength=function(spoolfile) {
    return this.receivedFilesForSpool[spoolfile].length;
};

Receiver.prototype.removeReceivedFileAtIndexSpool=function(spoolfile,index) {
    console.log(spoolfile+": removing file at index: "+index+": "+this.receivedFilesForSpool[spoolfile][index]);
    this.receivedFilesForSpool[spoolfile][index]=''; // don't just remove it as we are processing through
};

Receiver.prototype.clearReceivedFileForSpool=function(spoolfile) {
    if (this.receivedFilesForSpool[spoolfile]!=undefined) {
        this.receivedFilesForSpool[spoolfile]=null;
    }
    console.log(spoolfile+": clearing spoolfile ");
    delete this.receivedFilesForSpool[spoolfile];
};




Receiver.prototype.setArchivalURI = function(id,uri) {
    var req = {};

    req.archive_uri=uri;
    req.id=id;
    var self=this;
    this.kinaConnection.serverRequest('/set_archive_uri',req,function(data) {
        if (data.rval!='OK') {
            self.log("the archive URI for "+id+" could not be set: "+data.message);
        } else {
            // all good
            self.log("the archive URI for "+id+" set to: "+uri);
        }
    },function(error) {
        self.errorCount += 1;
        self.log("The error is: "+error);
    });
};

Receiver.prototype.log = function (logString) {
    this.kinaConnection.log(this.name+": "+logString);
};

Receiver.prototype.getName = function() {
    return this.name;
}


//Retrieves any ready transactions for processing. There are three potential callbacks:
//onZipReceived is called when the zip file is received.  If the onZipReceived function
// returns true, the function assumes the transactions are handled and the onEachFile 
// will not be called.
// If the onZipReceived is null or false, the onEachFile callback will be called 
// with the saveDirectory (string) and transactiondata (hash) as arguments.
// See the connection_runner code for an example of handling this.

Receiver.prototype.processReadyTransactions = function(onZipReceived, onEachFile,errorFunction) {

    var self = this;
    if (this.packagingJSON==null) {
        this.kinaConnection.log(this.name+": packaging template is invalid");
        return self.moreAvailable;

    }

    if (this.busy) {
        this.kinaConnection.log(this.name+": processReadyTransactions: already busy");
        return self.moreAvailable;

    }


    if (self.readyTransactions.length==0) {
        //this.kinaConnection.log(this.name+": no ready transactions for packaging");
        return self.moreAvailable;

    }

    this.busy=true;

    // let's get the transaction set
    var req = {};
    req.private_key=this.credentials.private_key;
    req.pass_phrase=this.credentials.pass_phrase;
    req.transaction_set=JSON.stringify(this.readyTransactions);
    req.packaging_json=this.packagingJSON.template_data;
    //require('request').debug = true;
    this.kinaConnection.serverRequest('/package_set',req,
    function(data) {
        // now get the spool file
        if (data.rval=='OK') {
            console.dir(data)
            if ((data.above_limit!=null) && (data.above_limit.length>0)) {
                //we will have more
                self.kinaConnection.log(self.name+": there are more transactions available");
                self.moreAvailable=true;
            } else {
                self.moreAvailable=false;
            }
            self.getSpoolFile(data.spool_file,onZipReceived,onEachFile,errorFunction);
            return self.moreAvailable;
        }
        self.busy=false;
    },
    function(error) {
        console.log(error);
        self.errorCount += 1;
        self.busy=false;
    });

    return self.moreAvailable;
};


Receiver.prototype.getSpoolFile = function(spoolFile,onZipReceived,onEachFile,errorFunction) {
    var self=this;
    self.onEachFile=onEachFile;

    var options = {
        uri: this.kinaConnection.server + "/spool",
        method: "GET",
        json: true,
        qs: {
            "spool_file": spoolFile
        },
        headers: {
            'X-CSRF-Token': this.kinaConnection.auth_token
        },
        encoding: null,
        jar: true
    };
    //require('request').debug = true;
    // disposition it
    request.get(
        options
        , function (error, response, body) {
            if (error != null) {
                self.errorCount += 1;
                errorFunction(error);
            }
            if (response.statusCode != 200) {
                errorFunction(error);
            } else {
                // make a zip with the body
                try {
                    var zip = JSZip(body);
                } catch (e) {
                    self.errorCount += 1;
                    errorFunction(e);
                    return;
                }
                if (onZipReceived!=null) {
                    var rval=onZipReceived(zip);
                    if (rval==true) return;     // the zip function has handled
                }
                //workspace.log(zip);
                // make directories

                // make a list of entries
                self.zipEntries=[];
                var lastEntry = undefined;
                for (var key in zip.files) {
                    var o = new zl.ZipListEntry(self, key, zip.files[key],self.receiveDirectory,self.onEachFile,spoolFile);
                    if (lastEntry != null) lastEntry.setNextEntry(o);
                    self.zipEntries.push(o);
                    self.receivedCount++;
                    lastEntry = o;
                }

                // start processing the work

                if (self.zipEntries.length>0) {
                    self.zipEntries[0].start();
                }
                // now it is complete
            }
        }
    );

};

// Receives the ready transactions from the server - ones that are in a 'Complete' state.
// Will call the completeFunction with the transaction set that is ready.  This will 
// be an array.
// 
// Once you check the server for the ready transaction list using the getReadyTransactions function, 
// call processReadyTransactions and they will be downloaded.


Receiver.prototype.getReadyTransactions = function(completeFunction,errorFunction) {

    var self = this;

    if (this.busy) {
        this.kinaConnection.log(this.name+": getReadyTransactions: already busy");
        return;
    }


    var req = {};
    req.grouping_id=this.groupingID;
    req.status=1;
    self.readyTransactions=[];
    this.busy=true;
    this.kinaConnection.serverRequest('/transaction_set',req,function(data) {
        self.busy=false;
        if (data.rval!="OK") {
                errorFunction(data);
            }
            self.readyTransactions=data.transaction_set;
            completeFunction(data.transaction_set);
        },
        function(e) {
            self.busy=false;
            self.errorCount++;
            errorFunction(e);
        },'get');

};



exports.Receiver=Receiver;
