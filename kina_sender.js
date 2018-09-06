/**
 * Kina Sender - Watches a locally accessible folder for new files and then transmits them 
 *               to the Kina server.  When complete can optionally execute a callback function
 *               for post-send processing.
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




// The Sender class creates a watcher on a directory
// and sends any files that are written there to the
// kina server.
// NOTE: you must be logged into the Kina server.

// kinaConnection = the object containing the connection details (server, authorization token)
// name = identifier for this object for logging purposes.  
// directory = the directory to watch.  Any completed files here will be sent to the Kina server
// uploadProfile = object containing properties to send with each uploaded files
// completeFunction - function to call when the upload completes.  Passed a response object or error
//      function(response, error)


function Sender(kinaConnection, name, directory, uploadProfile, completeFunction,errorFunction) {

        this.watchDirectory = directory;
        this.watchFile = directory+path.sep+".watch";
        this.kinaConnection = kinaConnection;
        this.log = this.kinaConnection.log;
        this.uploadProfile = uploadProfile;
        this.completeFunction = completeFunction;
        this.errorFunction = errorFunction;
        this.name=name;
        this.errorCount=0;
        this.sendCount=0;
        this.processingFile=null;

        console.log(this.name+": sender initialized");

}

Sender.prototype.getName = function() {
    return this.name;
};


Sender.prototype.dispositionSentFile = function(b,filename) {
    this.log("dispositioning completed file: "+filename);
    if (this.completeFunction!=null) this.completeFunction(b,filename);
};

// start sending to the kina server

Sender.prototype.start = function() {
    if (this.kinaConnection.connected==false) {
        this.log(this.name+": cannot send files due to not being connected to the server.");
    }
    // set up a watch on the directory
    var me=this;
    this.watcher = fs.watch(this.watchDirectory, function (evt, filename) {
        files = fs.readdirSync(me.watchDirectory);
        if (files.length == 0) return;
        me.list = files;
        // ignore the files starting with .
        var fileValid = false;
        for (var i = 0; i < files.length; i++) {
            var fileName = files[i];
            if (fileName[0]=='.') continue;
            if (fs.lstatSync(me.watchDirectory + path.sep + fileName).isDirectory()) continue;
            fileValid = true;
            break;  // found something - move on it...
        }
        if (!fileValid) {
            me.log(me.getName()+": no ready qualified files");
            return;
        }
        //self.log("reading: " + self.watchDirectory + path.sep + fileName);
        if (me.processingFile != null) {
            //self.log("already processing file: " + self.processingFile + " ..skipping");
            return;
        }
        var stat = fs.lstatSync(me.watchDirectory + path.sep + fileName);

        if (stat.size == 0) {
            me.log(me.watchDirectory + path.sep + fileName + ": file is 0 length..skipping");
            return;
        }
        me.processingFile = fileName;
        //workspace.mainWindow.webContents.send('sendFile', si.watchDir+path.sep+fileName);
        me.sendFile(me.watchDirectory + path.sep + fileName, me.uploadProfile.transaction_type, me.watchDirectory);
        // upload the file
    });
    // now tickle the directory
    setTimeout(function() {
        fs.appendFile(me.watchFile, 'a', function (err) {
            if (err != null) me.log("an error occurred making .watch: " + err);
        });
    },1000);
    console.log(this.name+": started");

};

// stop sending to the server once any pending transfer are complete

Sender.prototype.stop = function() {
    this.watcher.close();
};

Sender.prototype.log = function(l) {
    if (this.kinaConnection.log) {
        this.kinaConnection.log(l);
    } else {
        console.log(this.getName()+": "+l);
    }

};



Sender.prototype.sendFile = function(fileName, transactionType) {

    // build the request...
    self=this;
    var tvalues = this.uploadProfile.values;
    tvalues["source_uri"]=fileName;
    tvalues["inbox"]=this.uploadProfile.name

    var options = {
        uri: self.kinaConnection.server + "/document_types/process_document",
        method: "POST",
        json: true,
        formData: {
            "authenticity_token": self.kinaConnection.auth_token,
            "filename": path.win32.basename(fileName),
            "inbox": this.uploadProfile.name,
            "transaction_type": transactionType,
            "transaction_values": JSON.stringify(tvalues),
            "content_type": mime.getType(fileName),
            "file0": {
                value: fs.createReadStream(fileName),
                options: {
                    filename: fileName,
                    contentType: mime.getType(fileName)
                }
            }
        },

        jar: true
    };
    //require('request').debug = true;
    self.log("sendFile: using: "+transactionType+": file "+fileName);
    // disposition it
    request.post(
        options
        , function (error, response, body) {
            if (error != null) {
                self.log("error: " + error);
                setTimeout(function() {
                    self.processingFile=null;
                    self.log("retrying..."+fileName);
                    fs.appendFile(self.watchFile, 'a', function (err) {
                        self.errorCount++;
                        if (err != null) self.log("an error occurred touching .watch: " + err);
                    });
                },1500);
                return;
            }
            //self.log("body: "+body);
            //var b = JSON.parse(body);


            //workspace.log(JSON.stringify(body));
            var b = body;
            self.processingFile = null;

            if (body==undefined) {
                workspace.log("error: got an empty body back from the post - retrying");

                fs.closeSync(fs.openSync(fileName, 'a'));  // touch the file
                return;
            }


            if (b!=undefined && b.rval == "OK") {
                self.sendCount++;
                self.log(self.getName()+": file " + fileName + ": posted successfully: " + b.transaction.master_transaction_id);
                // now disposition the sent file
                self.dispositionSentFile(b,fileName);
            } else {
                self.errorCount++;
                self.log("error: " + fileName + ": " + b.message);
                self.processingFile = null;
                if (b==undefined) {
                    b={};
                    b['rval']='FAIL';
                    b['message']='NON OK Response';
                    b['response']=response;
                }
                if (self.errorFunction!=null) self.errorFunction(b,fileName);
                return;
            }
            if (response != null) {
                if (response.statusCode!=200) {
                    self.errorCount++;
                    b={};
                    b['rval']='FAIL';
                    b['message']='NON OK Response';
                    b['response']=response;
                    self.errorFunction(b,fileName);
                }
            }
        }
    );

};

exports.sendSingleFile = function (connection, filename, uploadProfile, completeFunction, errorFunction) {
    var tvalues = uploadProfile.values;
    tvalues["source_uri"] = filename;

    var options = {
        uri: connection.server + "/document_types/process_document",
        method: "POST",
        json: true,
        formData: {
            "authenticity_token": connection.auth_token,
            "filename": path.win32.basename(filename),
            "transaction_type": uploadProfile.transaction_type,
            "transaction_values": JSON.stringify(tvalues),
            "content_type": mime.getType(filename),
            "file0": {
                value: fs.createReadStream(filename),
                options: {
                    filename: filename,
                    contentType: mime.getType(filename)
                }
            }
        },
        jar: true
    };
    request.post(
        options,
        function (error, response, body) {
            if (error != null) {
                errorFunction(error);
                return;
            }
            let b = body;
            self.processingFile = null;
            completeFunction(b, filename);
        }
    );

};


exports.Sender=Sender;
