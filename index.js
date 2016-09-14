//globals
var mobileapplication, url;
var funcobj = {};
var funcobjreturn = {};
var webdriver, driver, By, until;
var asyncall = require("async");
var sys = require("util"),
    my_http = require("http"),
    path = require("path"),
    nurl = require("url"),
    filesys = require("fs"),
    fs = require("fs"),
    qs = require("querystring");
var vm = require('vm');
var log4js = require('log4js');
var ss = require('siebelseleniumscript');
//ss.start();
var jsonarr = [];
var injectscript = true;
var baseurl = "http://localhost:5984/testcase";
var masterscript;
var mastersocket;
//load the selenium script commenting this out and moving to a nodejs module yippie !!!
//eval(fs.readFileSync('siebelselscript.js') + '');
//Creating New httpServer
var myserver = my_http.createServer(function(request, response) {
    var my_path = nurl.parse(request.url).pathname;
    route(my_path, request, response);
}).listen(8888);
/*var myserver = my_http.createServer(function(request, response) {
    var my_path = nurl.parse(request.url).pathname;
    route(my_path, request, response);
}).listen(9999);*/
//Configuring log4js
log4js.configure({
    appenders: [{
        type: 'console'
    }, {
        type: 'file',
        filename: 'logs/selenium.log',
        category: 'selenium'
    }]
});
var logger = log4js.getLogger("selenium");
logger.debug("Selenium Server Running on 8888");
//logger.debug("Selenium Server Running on 9999");
//starting socket with localhost test client
var io = require('socket.io').listen(myserver);
io.sockets.on('connection', function(socket) {
    mastersocket = socket;
    socket.emit('news', {
        'hello': 'Socket Established'
    });
    socket.on('my other event', function(data) {
        logger.debug(data);
    });
});
//main routing function for httpserver
function route(path, request, response) {
    logger.debug("Now routing to : " + path);
    switch (path) {
        case "/test":
            var body = "";
            request.on('data', function(data) {
                body += data.toString();
            });
            request.on('end', function() {
                var scriptjson = JSON.parse(body);
                genSelScript(response, scriptjson);
            });
            break;
        case "/testcase":
            var tcpath = process.cwd() + "/www/index.html";
            filesys.readFile(tcpath, "binary", function(err, file) {
                if (err) {
                    response.writeHeader(500, {
                        "Content-Type": "text/plain"
                    });
                    response.write(err + "\n");
                    response.end();
                }
                else {
                    response.writeHeader(200);
                    response.write(file, "binary");
                    response.end();
                }
            });
            break;
        case "/socket.io":
            break;
        default:
            var full_path = process.cwd() + "/www/" + path;
            filesys.exists(full_path, function(exists) {
                if (!exists) {
                    response.writeHeader(404, {
                        "Content-Type": "text/plain"
                    });
                    response.write("404 Not Found\n");
                    response.end();
                }
                else {
                    filesys.readFile(full_path, "binary", function(err, file) {
                        if (err) {
                            response.writeHeader(500, {
                                "Content-Type": "text/plain"
                            });
                            response.write(err + "\n");
                            response.end();
                        }
                        else {
                            response.writeHeader(200);
                            response.write(file, "binary");
                            response.end();
                        }
                    });
                }
            });
            break;
    }
}

function genSelScript(response, scriptjson) {
    try {
        masterscript = (scriptjson);
        console.log(masterscript);
        var funcarray = [];
        logger.info("Setting mastersocket & logger utility in siebelseleniumscript");
        ss.setlogger(logger);
        ss.setmastersocket(mastersocket);
        for (var k in scriptjson) {
            var params = scriptjson[k];
			var operation = scriptjson[k]["operation"].toLowerCase();
			var id = scriptjson[k]["id"];
			logger.debug("now creating function :: " + operation);
            var b = function(id, operation,params,callback) {
                ss[operation](params, callback);
            }
            funcobj[id] = asyncall.apply(b, id,operation,params);
        }
        console.log(funcobj);
        asyncall.series(funcobj, function(error, results) {
            logger.info("Execution Completed");
			//logger.info(error);
			//logger.info(results);
            if (error !== undefined && error !== null) {
				/*logger.error(error);
                response.writeHeader(500);
                response.write(error.toString());
                response.end();
                mastersocket.emit('news', {
                    'msg': 'Test Case Execution Completed'
                });
                //exit(error);*/
				mastersocket.emit('news', {
                    'msg': 'Error Encountered'
                });			
				ss.exit(error);				
            }
            else if (results !== undefined && results !== null) {
				/*logger.info("All test Cases Successful");
                response.writeHeader(200);
                response.write(JSON.stringify(results));
                response.end();*/
                mastersocket.emit('news', {
                    'msg': 'Test Case Execution Completed'
                });
				ss.exit();
                //            
            }
			response.writeHeader(200);
			response.write(JSON.stringify(results));
			response.end();	
        });
    }
    catch (e) {
        logger.error(e);
        response.writeHeader(500);
        response.write(e.toString());
        response.end();
    }
}

function genSelScript_olkd(response, scriptjson) {
    try {
        masterscript = (scriptjson);
        var funcarray = [];
        logger.info("Setting mastersocket & logger utility in siebelseleniumscript");
        ss.logger(logger);
        ss.mastersocket(mastersocket);
        for (var k in scriptjson["rows"]) {
            var id = scriptjson["rows"][k]["value"]["_id"];
            switch (scriptjson["rows"][k]["value"]["Operation"].toLowerCase()) {
                case "drilldown":
                    logger.info("creating drilldown function");
                    var appletname;
                    var field = {};
                    var dependency = {};
                    for (var j in scriptjson["rows"][k]["value"]["testdata"]) {
                        switch (scriptjson["rows"][k]["value"]["testdata"][j]["Param Type"].toLowerCase()) {
                            case "applet":
                                appletname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "field":
                                var name = scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"];
                                var value = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                var qualifier = scriptjson["rows"][k]["value"]["testdata"][j]["Field Type"];
                                var pickuifield = scriptjson["rows"][k]["value"]["testdata"][j]["Field Additional Info"];
                                field[name] = {
                                    "value": value,
                                    "type": qualifier,
                                    "pickfield": pickuifield
                                };
                                //field = value;
                                break;
                            case "dependency":
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]] = scriptjson["rows"][k]["value"]["testdata"][j]["Dependency Step"];
                                break;
                        }
                    }
                    //snippetcreator_json("newrecord", appletname, field);
                    var b = function(id, callback) {
                        ss.drilldown(appletname, field, dependency, id, callback);
                    }
                    funcobj[scriptjson[k]["id"]] = asyncall.apply(b, scriptjson[k]["id"]);
                    //funcarray.push(b);
                    break;
                case "exit":
                    logger.info("creating function exit");
                    var b = function(id, callback) {
                            ss.exit(id, callback);
                        }
                        //funcarray.push(b);
                    funcobj[scriptjson[k]["id"]] = asyncall.apply(b, scriptjson[k]["id"]);
                    break;
                case "setup":
                    logger.info("creating function setup");
                    var dependency = {};
                    for (var j in scriptjson["rows"][k]["value"]["testdata"]) {
                        switch (scriptjson["rows"][k]["value"]["testdata"][j]["Param Type"]) {
                            case "mobileapplication":
                                mobileapplication = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "url":
                                url = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "dependency":
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]] = scriptjson["rows"][k]["value"]["testdata"][j]["Dependency Step"];
                                break;
                        }
                    }
                    var b = function(id, callback) {
                        ss.start(mobileapplication, dependency, id, callback);
                    }
                    funcobj[scriptjson[k]["id"]] = asyncall.apply(b, scriptjson[k]["id"]);
                    break;
                case "login":
                    logger.info("creating function login");
                    var dependency = {};
                    var uid, pwd, sso, uidfldname, pwdfldname, ssologin, ssopwd, ssouid, loginbutton, homepage;
                    for (var j in scriptjson["rows"][k]["value"]["testdata"]) {
                        switch (scriptjson["rows"][k]["value"]["testdata"][j]["Param Type"]) {
                            case "username":
                                uid = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "password":
                                pwd = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "sso":
                                sso = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "ssouid":
                                ssouid = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "ssopwd":
                                ssopwd = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "uidfldname":
                                uidfldname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "pwdfldname":
                                pwdfldname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "ssologin":
                                ssologin = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "loginbutton":
                                loginbutton = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "homepage":
                                homepage = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "dependency":
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]] = {};
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]].type = scriptjson["rows"][k]["value"]["testdata"][j]["Field Type"];
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]].value = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                        }
                    }
                    var b = function(id, callback) {
                        ss.login(url, uid, pwd, sso, uidfldname, pwdfldname, loginbutton, ssouid, ssopwd, ssologin, homepage, dependency, id, callback);
                    }
                    funcobj[scriptjson[k]["id"]] = asyncall.apply(b, scriptjson[k]["id"]);
                    break;
                case "gotoview":
                    logger.info("creating function gotoview");
                    var view, applet1, applet2, rowid1, rowid2, displayname;
                    var dependency = {};
                    for (var j in scriptjson["rows"][k]["value"]["testdata"]) {
                        switch (scriptjson["rows"][k]["value"]["testdata"][j]["Param Type"]) {
                            case "view":
                                view = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "applet1":
                                applet1 = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "applet2":
                                applet2 = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "rowid1":
                                rowid1 = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "rowid2":
                                rowid2 = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "displayname":
                                displayname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "dependency":
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]] = scriptjson["rows"][k]["value"]["testdata"][j]["Dependency Step"];
                                break;
                        }
                    }
                    var b = function(id, callback) {
                        ss.gotoview(view, applet1, applet2, rowid1, rowid2, displayname, dependency, id, callback);
                    }
                    funcobj[scriptjson[k]["id"]] = asyncall.apply(b, scriptjson[k]["id"]);
                    break;
                case "newrecord":
                    logger.info("creating function newrecord");
                    var applet = {},
                        appletname, view, applet1, applet2, rowid1, rowid2, displayname;
                    var field = {};
                    var sortedfield = {};
                    var dependency = {};
                    var view = "";
                    for (var j in scriptjson["rows"][k]["value"]["testdata"]) {
                        switch (scriptjson["rows"][k]["value"]["testdata"][j]["Param Type"].toLowerCase()) {
                            case "view":
                                view = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "operation":
                                break
                            case "applet":
                                appletname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "displayname":
                                displayname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "field":
                                var name = scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"];
                                var value = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                var qualifier = scriptjson["rows"][k]["value"]["testdata"][j]["Field Type"];
                                var pickuifield = scriptjson["rows"][k]["value"]["testdata"][j]["Field Additional Info"];
                                field[name] = {
                                    "value": value,
                                    "type": qualifier,
                                    "pickfield": pickuifield
                                };
                                //console.log(field);
                                break;
                            case "dependency":
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]] = scriptjson["rows"][k]["value"]["testdata"][j]["Dependency Step"];
                                break;
                        }
                    }
                    //sort field array to bring up pickfields first
                    var sortedkey = Object.keys(field).sort(function(p, q) {
                        if (field[p].type > field[q].type) return 1;
                        else return 0;
                    })
                    for (var x in sortedkey) {
                        sortedfield[sortedkey[x]] = field[sortedkey[x]];
                    }
                    var b = function(id, callback) {
                            ss.newrecord(view, appletname, sortedfield, dependency, id, callback);
                        }
                        //funcarray.push(b);
                    funcobj[scriptjson[k]["id"]] = asyncall.apply(b, scriptjson[k]["id"]);
                    break;
                case "updaterecord":
                    logger.info("creating function updaterecord");
                    var applet = {},
                        appletname, view, applet1, applet2, rowid1, rowid2, displayname, searchspec;
                    var updfield = {};
                    var dependency = {};
                    var queryfield = {};
                    for (var j in scriptjson["rows"][k]["value"]["testdata"]) {
                        switch (scriptjson["rows"][k]["value"]["testdata"][j]["Param Type"].toLowerCase()) {
                            case "operation":
                                break
                            case "applet":
                                appletname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "displayname":
                                displayname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "searchspec":
                                searchspec = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "queryfield":
                                var name = scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"];
                                var value = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                var qualifier = scriptjson["rows"][k]["value"]["testdata"][j]["Field Type"];
                                var pickuifield = scriptjson["rows"][k]["value"]["testdata"][j]["Field Additional Info"];
                                queryfield[name] = {
                                    "value": value,
                                    "type": qualifier,
                                    "pickfield": pickuifield
                                };
                                break;
                            case "field":
                                var name = scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"];
                                var value = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                var qualifier = scriptjson["rows"][k]["value"]["testdata"][j]["Field Type"];
                                var pickuifield = scriptjson["rows"][k]["value"]["testdata"][j]["Field Additional Info"];
                                updfield[name] = {
                                    "value": value,
                                    "type": qualifier,
                                    "pickfield": pickuifield
                                };
                                break;
                            case "dependency":
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]] = scriptjson["rows"][k]["value"]["testdata"][j]["Dependency Step"];
                                break;
                        }
                    }
                    //sort field array to bring up pickfields first
                    var sortedkey = Object.keys(updfield).sort(function(p, q) {
                        if (updfield[p].type > updfield[q].type) return 1;
                        else return 0;
                    })
                    for (var x in sortedkey) {
                        sortedfield[sortedkey[x]] = updfield[sortedkey[x]];
                    }
                    var b = function(id, callback) {
                            ss.updaterecord(appletname, searchspec, sortedfield, queryfield, dependency, id, callback);
                        }
                        //funcarray.push(b);
                    funcobj[scriptjson[k]["id"]] = asyncall.apply(b, scriptjson[k]["id"]);
                    break;
                case "customoperation":
                    logger.info("creating function customoperation");
                    var appletname;
                    var dependency = {};
                    var control = {};
                    for (var j in scriptjson["rows"][k]["value"]["testdata"]) {
                        switch (scriptjson["rows"][k]["value"]["testdata"][j]["Param Type"].toLowerCase()) {
                            case "applet":
                                appletname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "control":
                                var name = scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"];
                                var value = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                var qualifier = scriptjson["rows"][k]["value"]["testdata"][j]["Field Type"];
                                var pickuifield = scriptjson["rows"][k]["value"]["testdata"][j]["Field Additional Info"];
                                control[name] = {
                                    "value": value,
                                    "type": qualifier,
                                    "pickfield": pickuifield
                                };
                                break;
                            case "dependency":
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]] = scriptjson["rows"][k]["value"]["testdata"][j]["Dependency Step"];
                                break;
                        }
                    }
                    var b = function(id, callback) {
                            ss.customoperation(appletname, value, dependency, id, callback);
                        }
                        //funcarray.push(b);
                    funcobj[scriptjson[k]["id"]] = asyncall.apply(b, scriptjson[k]["id"]);
                    break;
                case "verifyhtml":
                    logger.info("creating function verifyhtml");
                    var appletname;
                    var dependency = {};
                    var control = {};
                    for (var j in scriptjson["rows"][k]["value"]["testdata"]) {
                        switch (scriptjson["rows"][k]["value"]["testdata"][j]["Param Type"].toLowerCase()) {
                            case "applet":
                                appletname = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                break;
                            case "control":
                                var name = scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"];
                                var value = scriptjson["rows"][k]["value"]["testdata"][j]["Param Value"];
                                var qualifier = scriptjson["rows"][k]["value"]["testdata"][j]["Field Type"];
                                var pickuifield = scriptjson["rows"][k]["value"]["testdata"][j]["Field Additional Info"];
                                control[name] = {
                                    "value": value,
                                    "type": qualifier,
                                    "pickfield": pickuifield
                                };
                                break;
                            case "dependency":
                                dependency[scriptjson["rows"][k]["value"]["testdata"][j]["Param Name"]] = scriptjson["rows"][k]["value"]["testdata"][j]["Dependency Step"];
                                break;
                        }
                    }
                    var b = function(id, callback) {
                            ss.verifyhtml(appletname, control, dependency, id, callback);
                        }
                        //funcarray.push(b);
                    funcobj[scriptjson[k]["id"]] = asyncall.apply(b, scriptjson[k]["id"]);
                    break;
            }
        }
        //console.log(funcobj);
        asyncall.series(funcobj, function(error, results) {
            logger.info("All methods processed");
            if (error !== undefined && error !== null) {
                response.writeHeader(500);
                response.write(error.toString());
                response.end();
                mastersocket.emit('news', {
                    'msg': 'Test Case Execution Completed'
                });
                //exit(error);            
            }
            else if (results !== undefined && results !== null) {
                response.writeHeader(200);
                response.write(JSON.stringify(results));
                response.end();
                mastersocket.emit('news', {
                    'msg': 'Test Case Execution Completed'
                });
                //exit();            
            }
        });
    }
    catch (e) {
        logger.error("indexjs error handler-" + e);
        response.writeHeader(500);
        response.write(e.toString());
        response.end();
    }
}