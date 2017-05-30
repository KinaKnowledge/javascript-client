/**
 * Connection Runner - Driver for sending and receiving files with Kina
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

const kina=require('./kina_connection');
const sender=require('./kina_sender');
const receiver=require('./kina_receiver');

const fs=require('fs');
const path=require('path');


if (process.argv.length<3) {
    console.log("Connection Runner: please provide a json file as an argument that contains the following: ");
    console.log('{');
    console.log('   "server_url": "https://fs.kinadata.com",');
    console.log('   "user_name": "sample.email@myorg.org",');
    console.log('   "password": "R@YuPhEd2A4c3_05",');
    console.log('   "private_key_file": "/path/to/local/private_key.pem",');
    console.log('   "pass_phrase_file": "/path/to/local/pass_phrase.txt",');
    console.log('   "channels": [');
    console.log('      {');
    console.log('         "name": "sender_1",');
    console.log('         "upload_profile": "From Scanner",');
    console.log('         "send_directory": "/path/to/local/sending/directory"');
    console.log('      },');
    console.log('      {');
    console.log('         "name": "receiver_1",');
    console.log('         "packaging_profile": "Department Share Drive",');
    console.log('         "grouping_id": "",');
    console.log('         "receive_directory": "/path/to/local/receiving/directory"');
    console.log('      }');
    console.log('   ]');
    console.log('}');
    process.exit(1);
}

var filedata=process.argv[2];
console.log("Connection Runner: starting with "+filedata);
var configData=fs.readFileSync(filedata,'utf8');
var config=JSON.parse(configData);
console.log("Connection Runner: server: "+config.server_url);
var senders=[];
var receivers=[];

var countDown = 10;

var private_key = fs.readFileSync(config.private_key_file,'utf8');
var pass_phrase = fs.readFileSync(config.pass_phrase_file,'utf8');

var credentials={};

credentials.ok=false;

if ((private_key!=null)&&(pass_phrase!=null)) {
    console.log("Connection Runner: private key/pass phrase loaded OK");
    credentials.ok=true;
    credentials.private_key=private_key;
    credentials.pass_phrase=pass_phrase;
} else {
    if (private_key==null) console.error("Connection Runner: warning: missing private key");
    if (pass_phrase==null) console.error("Connection Runner: warning: missing pass phrase");
    console.log("Connection Runner: no receivers will be initialized");
}


var connection = new kina.KinaConnection(config.server_url,config.user_name, config.password, function(c,d) {
    // we are connected
    console.log("Connection Runner: connected: "+d.current_user_name);


    if (config.channels==null) {
        console.log("No channels have been defined in the config file.");
        process.exit(1);
    }


    var channels = config.channels;
    for (var index in channels) {
        var channel=channels[index];
        if (channel.upload_profile != null) {
            var s=new sender.Sender(c,channel.name,channel.send_directory,c.getUploadProfile(channel.upload_profile),
                function(b,filename) {
                    try {

                        var dir = path.dirname(filename);
                        var tf=dir + path.sep + "sent"+path.sep+path.basename(filename)
                        fs.renameSync(filename, tf);
                        console.log("Moved transmitted file to " + tf);
                    } catch (exception) {
                        console.log(exception);
                    }
                },
                function(e,filename) {
                    console.log("There was an error sending "+filename+" to the server.");
                    console.log("error: "+e.message);
                });
            s.start();
            senders.push(s);
        } else if (channel.packaging_profile!=null) {
            // 
            // this is a receiver. Replace the sample code with your own call back function/object. See below.
            // 
            var r=new receiver.Receiver(c,channel.name,channel.grouping_id,channel.receive_directory,channel.packaging_profile,credentials);
            setInterval(function() {
                if (r.moreAvailable || countDown <= 0) {
                    countDown = 30;
                    r.getReadyTransactions(
                        function (transactionSet) {

                            r.processReadyTransactions(null, function (saveDirectory, trx) {
                                    // stub code - process the received document and transaction data as needed
                                    console.log("Received transaction: " + trx.id + " :" + trx.document_type_name + ": into " + saveDirectory + path.sep + trx.zip_entry);
                                    return null;  // don't send anything back to Kina
                                },
                                function (error) {
                                    console.error("An error occurred");
                                    console.dir(error);
                                });

                        }, function (error) {
                            console.log("received an error: " + error);
                        });
                }
                countDown--;
            }, 1000);
            receivers.push(r);
        }

    }


}, function(e) {
    console.log("error: ",e);
}, function(l) {
    console.log("Connection Runner: "+l);
}, false);

// report every minute on conditions

setInterval(function() {
    for (var i in senders) {
        var s=senders[i];
        console.log(s.getName()+": sent files: "+s.sendCount+"    # errors: "+s.errorCount+"    processing file: "+(s.processingFile||'N/A'));
    }
    for (var i in receivers) {
        var r=receivers[i];
        console.log(r.getName()+": recv files: "+r.receivedCount+"    # errors: "+r.errorCount+"    busy: "+(r.busy));
    }
},60000);


showUploadProfiles=function(profiles) {

    console.log("Please add a \"upload_profile\" to the configuration.");
    console.log("Available For This User:");
    for (var profile in profiles) {
        console.log("      "+profile);
    }
};
