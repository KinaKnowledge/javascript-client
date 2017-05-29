/**
 * ZipList Entry - processes an entry in a received spool file
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

const fs = require('fs');
const url = require('url');
const os = require('os');
const path = require('path');
const mkdirp = require('mkdirp');

class ZipListEntry {
    constructor(receiver, key, entry, saveLocation,onEachFile,spoolFile) {
        this.entry = entry;
        this.receiver=receiver;
        this.spoolFileName = spoolFile;
        this.key = key;
        this.count = 0;
        this.transactionID="NA";
        this.type="";
        this.nextEntry=undefined;
        this.saveLocation = saveLocation;
        this.onEachFile=onEachFile;
        this.setNextEntry = (nextEntry) => {
            if (nextEntry==null) return;
            //this.log("Next entry is set to: "+nextEntry.key);
            this.nextEntry = nextEntry;
        };
        var self=this;
        this.setType = (s) => {
            this.type=s;
        };
        this.log = (s) => {
           this.receiver.log(this.key+": "+this.transactionID+": "+s);
        };
        this.complete = () => {
            //this.log("completed processing: next entry is "+this.nextEntry);
            if (this.nextEntry==null) {
                setTimeout(function() {


                    if (self.onEachFile==null) {
                        self.log("No javascript function to run onEachFile, finished.")
                    }
                    //this.log("Processing JSON entries with javascript file: "+this.receiveJavaScript);
                    // this is where we call the Javascript process sequentially for each
                    // JSON entry
                    if (self.onEachFile!=null) {
                        for (var i = 0; i < self.receiver.getReceivedSpoolLength(self.spoolFileName); i++) {
                            var jsonFileName=self.receiver.getReceivedFileForSpool(self.spoolFileName,i);
                            if (jsonFileName.length==0) continue;     // already processed
                            self.receiver.removeReceivedFileAtIndexSpool(self.spoolFileName,i);
                            try {
                                var fileData=fs.readFileSync(saveLocation + path.sep + jsonFileName,'utf8');
                                //self.log(fileData);
                                var trx=JSON.parse(fileData);
                                var ds=self.onEachFile(self.saveLocation,trx);
                                if (ds!=null) {
                                    // set uri
                                    if (typeof ds=='object') ds=JSON.stringify(ds);
                                    self.receiver.setArchivalURI(trx.id,ds);
                                }

                            } catch(ex) {
                                self.log("There was an error with the callback procedure: "+ex);
                                console.dir(ex);
                            }
                        }
                    }
                    self.receiver.clearReceivedFileForSpool(self.spoolFileName);
                    //self.receiver.receivedFilesForSpool=[];
                    self.receiver.busy=false;
                    //clearInterval(this.postProcessProcessTimeout);
                    self.log("Refreshed the post process table");
                },1000);
            } else {
                setTimeout(function() {
                    self.nextEntry.start();
                },100);
            }

        };
        this.processEntry = () => {
            var self = this;
            saveLocation = this.saveLocation;
            var zo = self.entry;
            try {


                if (zo.dir == true) {
                    self.log(o.entry + ": is a dir: " + zo.name);
                    self.type = "dir";
                } else {
                    // this is a file..
                    var d = path.dirname(zo.name);
                    //self.log("making file directory: " + d);
                    mkdirp.sync(saveLocation + path.sep + d,null);
                    //self.log("getting the file from zip");
                    // write the file

                    var nb = zo.asNodeBuffer();
                    // if we receive a non-meta file, write it into our receive directory

                    fs.writeFileSync(saveLocation + path.sep + zo.name, nb);
                    self.setType("document");
                    self.log("wrote document file");
                    if (zo.name.endsWith(".json")) {
                        if (!zo.name.includes("named_entities")) {
                            self.receiver.addReceivedFileForSpool(self.spoolFileName, zo.name);
                        }
                    }
                    self.complete();
                }
            } catch (e) {
               self.log("an exception occured"+e);
                throw (e);
            }

        };
        this.start = () => {
            //this.log("start called");
            this.processEntry();
        }
    }



}




exports.ZipListEntry=ZipListEntry;