/**
 * Kina Connection - Establishes a connection to a kina_server endpoint, specified by a url.
 *                   Used by the kina_receiver and kina_sender classes.           
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

const request = require('request');

// server_url: formed url of the server address, eg https://fs.kinadata.com
//             protocol://servername[:port]
// user_id: the email_address (login id) of the user to authenticate as
// password: the password value
// completeFunction: a function to call once login is complete.
// errorFunction: a function to call with any connection errors
// logFunction: (optional) a function to call with log information (objects can be passed) (console is default)
// logLevel: (optional) boolean - if true details will be send to the log function



function KinaConnection(server_url,user_id, password, completeFunction, errorFunction, logFunction, logLevel) {

    this.server=server_url;
    this.user_id=user_id;
    this.password=password;
    this.completeFunction = completeFunction;
    this.errorFunction = errorFunction;
    this.verbose=false;
    this.connected=false;

    var self=this;

    if (logFunction!=null) {
        this.logFunction=logFunction;
    } else {
        this.logFunction=function(s) {
            console.log("KinaConnection: ",s);
        }
    }
    if (logLevel==true) {
        this.verbose=true;
    }
    this.logFunction("KinaConnection: starting");

    // 73.171.94.244

    // get the authenticity token into the cookie jar

    request({
        uri: self.server + "/auth",
        method: 'GET',
        jar: true
    }, function (error, response, body) {
        if (error != null) {
            self.errorFunction(error);
            return;
        }
        var b = JSON.parse(body);
        if (b.rval == "OK") {
            self.auth_token=b.auth_token;
            self.login();
        } else {
            self.errorFunction();
        }
    });

}

// returns the profile data for the specified profile name

KinaConnection.prototype.getUploadProfile = function(uploadProfileName) {

    return this.uploadProfilesData[uploadProfileName];
};



KinaConnection.prototype.log = function(item) {
    if (this.logFunction!=null) {
        this.logFunction(item);
    } else {
        console.log("KinaConnection: "+item);
    }
};


// Logs into the service

KinaConnection.prototype.login=function() {

    var self=this;
    var req = {
        email: self.user_id,
        password: self.password,
    };
    self.serverRequest('/client_login',req,function(d) {
        var req = {};
        self.serverRequest('/upload_profiles',req,function(up) {
                self.uploadProfilesData=JSON.parse(up.profiles)||{};
                self.connected=true;
                self.completeFunction(self,d);
            },
            function(e) {
                errorFunction(e);
            },'get');

    },self.errorFunction);
};

// receives the uploadProfiles from the Kina server that are available for use by
// the connected user and organization.

KinaConnection.prototype.uploadProfiles=function(successFunction, errorFunction) {
    var self=this;
    var req = {};
    self.serverRequest('/upload_profiles',req,function(d) {
       successFunction(JSON.parse(d.profiles)||{});
    },
    function(e) {
        errorFunction(e);
    },'get');
};

// executes a server request to Kina  Pass a url, your form data as a hash, the complete function 
// to call when completes OK, and an error function to call if failure.  
// Type can be 'get' or 'post'

KinaConnection.prototype.serverRequest=function(url,formData,completeFunction,errorFunction,type) {
    var self=this;
    if (type==null||type=='post') {
        request.post({
                url: self.server + url,
                formData: formData,
                jar: true,
                headers: {
                    'X-CSRF-Token': self.auth_token
                }
            },
            function (error, response, body) {
                if (error != null) {
                    if (self.verbose) self.logFunction(error);
                    errorFunction(error);
                    return;
                }

                var b = JSON.parse(body);
                if (b.rval == "OK") {

                    if (self.verbose) {
                        self.logFunction(body);
                    }
                    if (completeFunction!=null) {
                        completeFunction(b);
                    }
                } else {
                    errorFunction("Error: "+b.message);
                }
            })
    } else {
        // get
        request({
                url: self.server + url,
                formData: formData,
                jar: true,
                headers: {
                    'X-CSRF-Token': self.auth_token
                }
            },
            function (error, response, body) {
                if (error != null) {
                    if (self.verbose) self.logFunction(error);
                    errorFunction(error);
                    return;
                }

                var b = JSON.parse(body);
                if (b.rval == "OK") {
                    if (self.verbose) {
                        self.logFunction(body);
                    }
                    if (completeFunction!=null) {
                        completeFunction(b);
                    }
                } else {
                    errorFunction(b);
                }
            });
    }

};

exports.KinaConnection=KinaConnection;
