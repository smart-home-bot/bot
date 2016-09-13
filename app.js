var appInsights = require("applicationinsights");
appInsights.setup("2ceb0573-8643-457c-82cc-54a1a98680c0").start();
var client = appInsights.getClient();

var restify = require('restify');
var builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID || '95d70bbf-09d8-4410-974d-dbad41d36c98',
    appPassword: process.env.MICROSOFT_APP_PASSWORD || 'R4Mppn5yQxoeD0efBe9TCTG'
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', function (session) {
    session.send("Hello World");
});