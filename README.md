# javascript-client
## Document Transfer Client For [Kina](https://www.kinaknowledge.com)

### Intro

This repository implements a **node.js** javascript based client that implements logging in, sending to Kina, receiving from Kina and the unzipping, placement and processing via callouts the ready files.  Additionally, it retrieves the list of available upload profiles for the organization.  The license is MIT.  This code can be run stand alone at the command line via `connection_runner.js`, or embedded in your own application.

For those looking for a multi-platform ready to run GUI application, use the [Kina Listener](https://www.kinaknowledge.com/listener/using_kina_listener.html).

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

```javascript
Connection Runner: please provide a json file as an argument that contains the following: 
{
    "server_url": "https://fs.kinadata.com",
    "user_name": "sample.email@myorg.org",
    "password": "R@YuPhEd2A4c3_05",
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










