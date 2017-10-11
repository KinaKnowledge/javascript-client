# javascript-client
## Document Transfer Client For [Kina](https://www.kinaknowledge.com)

### Intro

This repository implements a **node.js** javascript based client that implements logging in, sending to Kina, receiving from Kina and the unzipping, placement and processing via callouts the ready files.  Additionally, it retrieves the list of available upload profiles for the organization.  The license is MIT.  This code can be run stand alone at the command line via `connection_runner.js`, or embedded in your own application.

For those looking for a multi-platform ready to run GUI application, use the [Kina Listener](https://www.kinaknowledge.com/listener/using_kina_listener.html).

These libraries send and receive over HTTPS.

### Dependencies

The following dependencies should be installed in your node environment, either globally or in `node_modules/` where applicable:

1. [Node.js](https://nodejs.org)
2. [request](https://www.npmjs.com/package/request)
3. [mime](https://www.npmjs.com/package/mime)
4. [mkdirp](https://www.npmjs.com/package/mkdirp)
5. [node-mime](https://www.npmjs.com/package/node-mime)
6. [node-zip](https://www.npmjs.com/package/node-zip)
7. [pretty-bytes](https://www.npmjs.com/package/pretty-bytes)
8. [temp](https://www.npmjs.com/package/temp)


Additionally you will need to make sure you have the private_key.pem file and the pass_phrase.txt file for the Kina user account you are going to use with this installation.  To get the key and passphrase file, login to Kina on the browser that you normally access Kina with (or create a new account) and perform the following:

1.  Login to [Kina](https://fs.kinadata.com/login) cloud or your local instance.
2.  In the upper right of your home screen, click on your username next to the user icon.  
3.  This will take you to your user profile.  Select the **Security Keys** tab.
4.  If you have a green Keys OK message, click on **Get Keys As Zip**.  Note: if this is a new user, you may need to generate new keys.  **ALWAYS** make sure you keep a backup of the keys zip file in a safe, secure place for your Kina user id.
5.  Open and unzip the `download.zip` file that downloads in your browser.
6.  Copy the `private_key.pem` file and the `pass_phrase.txt` file to a location that you can keep secure and available to the `connection_runner.js` and/or these libraries.

### Getting Started

Download the files in this repository to the target directory and install the dependencies via `npm`.  You will need to provide a JSON based configuration file that provides the connection details, and specifics for the directories you wish to send from and receive to.  To view the connection file format, type on the command line:

```
node connection_runner.js
```

This will display an example configuration file format in JSON:

```
Connection Runner: please provide a json file as an argument that contains the following: 
{
    "server_url": "https://fs.kinadata.com",
    "user_name": "sample.email@myorg.org",
    "password": "Rfgs$Ed2A4c3_05",
    "private_key_file": "/path/to/local/private_key.pem",
    "pass_phrase_file": "/path/to/local/pass_phrase.txt",
    "channels": [
      {
        "name": "sender_1",
        "upload_profile": "From Scanner",
        "send_directory": "/path/to/local/sending/directory"
      },
      {
        "name": "receiver_1",
        "packaging_profile": "Department Share Drive",
        "grouping_id": "",
        "receive_directory": "/path/to/local/receiving/directory"
      }
    ]
 }
```

To get started you can redirect the output of this command in Linux/Unix to write a sample configuration file which you can then edit, or create or provide one of your own.  **Note: Please ensure that the configuration file and your private key and pass phrase files are only visible to your local user on the installed computer that will be running these libraries.**  In Linux/Unix this should be permissions of 600:

```
$ chmod 600 my_config.conf
```

In Windows, right click and choose Properties, and visit the Security tab to set the permissions appropriately.

### Starting and Stopping

Provide the configuration file as an argument to the `connection_runner.js` as follows:

```
node connection_runner.js my_config.json
```

The connection runner will start if there are no issues with the keys or connection settings.  You will then see it log in and transfer any pending files from your local computer to Kina and receive any pending files after a minute or so.

To stop it, type Ctrl-C.


## Using the API

Using the API is fairly straightforward.  There are four classes that are used to connect, send, receive and process, respectively.

###Connecting

1.  First **connect** to the Kina server by creating a `KinaConnection` object.

```javascript
// import the libraries that you will be using

const kina=require('./kina_connection');
const sender=require('./kina_sender');
const receiver=require('./kina_receiver');

// create a connection

var connection = new kina.KinaConnection(server_url,
                                         username, 
                                         password, 
                                         function(kinaConnection,jsonObjectResponse) {
                                            // ready to do send/receive
                                         },
                                         function(error) {
                                            // error - something happened
                                         },
                                         function(logString) {
                                            // called when a message needs to be logged
                                         },
                                         logDetails);   // logdetails is a boolean value (true=more)                                     
```
Typically, your server URL will be `https://fs.kinadata.com`.  If your are running a local instance it will be the same URL that you point your browser to typically.  When a connection object is constructed, it will login and download any available **upload profiles** for your organization.  Upload profiles are configured within Kina in the Designer and used as a way to pass information to the Kina server.  They are hash objects that contain key,value pairs including the name of the process to run.

Once you have connected, then you are ready to send and receive.  For sending, use a `Sender` object.  You will need to provide a current connection object, an arbitrary name for the channel to identify itself for logging purposes, the directory to monitor and an appropriate upload profile.  The connection object has a lookup method that allows you to provide an upload profile name, and it will provide the appropriate hash object required for the `Sender` object.


### Sending

2.  To **send** documents to Kina, create a `Sender` object:

```javascript
var sender=new sender.Sender(connection,  
                             channelName,
                             sendDirectory,
                             connection.getUploadProfile(uploadProfileName),
                             function(responseBody,file) {
                                // this function is called when a file has 
                                // been successfully to the Kina server
                                // do something with the file such as delete it or move it
                             },
                             function(responseBody,file) {
                                // uh oh - couldn't send the file, 
                                // look at the error in responseBody
                             });
```

Once the `Sender` call returns, it will be ready to start watching the directory.  Call `start()` to start watching the directory for files to send to Kina.

```javascript
sender.start();
```

Files will start transferring to the server from the watched directory if there are any files present in it.  Messages that need to be logged or examined will be sent to the configured connection logger function provided in step 1. The error function will be called when errors in connectivity, or server response are encountered.


### Receiving

3.  To **receive** documents from Kina, create a `Receiver` object.  First, you'll need create a credentials object with the private key and pass phrase.  These are the contents of the zipped credential file.  See dependencies above for more information on creating these.

```javascript
const fs=require('fs');

var credentials={};

credentials.private_key = fs.readFileSync('/path/to/private_key.pem','utf8');
credentials.pass_phrase = fs.readFileSync('/path/to/pass_phrase.txt','utf8');

```
Next, create the receiver object.  Similar to the `Sender`, pass an active `connection` object, an identifier, called a channel, that the Receiver object will use to identify itself in the logs and messages.  The `groupingID` is a string value that is used to select documents by their assigned grouping ID within Kina.  This value can be blank, or null, as well and this will select objects that do not have a grouping ID.  The `receiveDirectory` is the location that received files are stored, and in most cases, unzipped into designated subdirectories under the `receiveDirectory`.  The string value `packagingProfile` determines which packaging profile will be used to create the zip file.   Packaging Profiles are configured within the Kina application in the Designer.  Once you have created and saved a Packaging Profile, you can refer to it in the API.  Finally, `credentials` is the object created above that contains the private key and pass phrase text.

```javascript
var receiver=new receiver.Receiver(connection,
                                   channelName,
                                   groupingID,
                                   receiveDirectory,
                                   packagingProfile,
                                   credentials);
```

Once you have created a receiver, you will need to check for ready documents every so often.  To do so, use the `getReadyTransactions()` method of the receiver.

```javascript
receiver.getReadyTransactions(function(transactionSet) {
    // Now we know that transactions are ready for pickup
    // Let's go pick them up here...
    
}, function(errorString) {
    // Uh oh something bad happened.  Let's look at the error
    // and see the issue.
});
```

To pick up the ready transaction set, call `processReadyTransactions` to perform the download from the Kina server.  There are three call outs that can be used.

```javascript
receiver.processReadyTransactions(function(zipObject) {
                                    /* a zip object is passed containing the documents and 
                                       meta-data.
                                       provide null to this function slot to bypass calling this
                                       return true to indicate to the processReadyTransactions that
                                       the zip file has been processed and should not be handled any further.
                                     */
                                  },
                                  function(saveDirectory, trx) {
    
                                    /* this function is called for each transaction object in the zip file
                                       saveDirectory is the root directory, specified when constructing the Receiver.
                                       trx is an object containing all the extracted and document metadata.
                                       the document location is the saveDirectory + trx.zip_entry
                                       return an optional object that is stored with the archive record in Kina
                                            {
                                                 "archive_uri": "/path/to/local/file",
                                                 "grouping_id": "Valid",
                                                 "client_index_1": "My local index"
                                            }
                                    */
                                    
                                  },function(error) {
                                    // the error function returned from request
                                  });
```

The Kina system will throttle connection attempts to check for ready transactions to roughly twice a minute. If documents are ready for pickup (**complete**  status), match the selection criteria of the `groupingID`, and the connecting user has ownership (and therefore encrypted with the connecting user's public key), they will be downloaded in a zip file.  The max allowed is 5 documents per zip file.  This means that the `Receiver` object will have to connect again to collect the next set.  If this occurs and there are more documents available, the receiver will be able to connect immediately back and retrieve the next set.  The `moreAvailable` flag will be set to `true`.  

The second function argument in the `processReadyTransactions` can return an object that is sent to Kina with information about the disposition status of the document and object.  It can return 3 values (or return null to bypass this function).
The object is structured as follows:
```json
{
     "archive_uri": "/path/to/local/file",
     "grouping_id": "Valid",
     "client_index_1": "My local index"
}
```

The following example implements a download client.  The code checks for completed documents every 60 seconds and will continue to get the next set of transactions every second until complete.  Once complete, it will throttle itself back to check every 60 seconds.  
 
 ```javascript
var countDown=0;

setInterval(function() {
                if (r.moreAvailable||countDown<=0) {
                    countDown = 30;
                    r.getReadyTransactions(
                        function (transactionSet) {

                            r.processReadyTransactions(null, function (saveDirectory, trx) {
                                    // stub code - process the received document and transaction data as needed
                                    console.log("Received transaction: "+trx.id+" :"+trx.document_type_name+": into "+saveDirectory+path.sep+trx.zip_entry);
                                    rval={};
                                    rval.archive_uri='/path/to/local/file';  // or whatever
                                    return rval;
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
            },1000);
```








