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

var recognizer = new builder.LuisRecognizer('https://api.projectoxford.ai/luis/v1/application?id=ac796f55-1f98-42e6-a069-53a34e0bbfb9&subscription-key=c378bb10282c40818fdcce7ffb865b17');
var intents = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', intents);

intents.matches('TurnOnLightsInRoom', [
    function (session, args, next) {
        var room = builder.EntityRecognizer.findEntity(args.entities, 'Room');
        if (!room) {
            builder.Prompts.choice(session, "On which room would you like to turn on the lights?","kitchen|bed room|living room|toilets|terace");
        } else {
            next({ response: room.entity });
        }
    },
    function (session, results) {
        if (results.response) {
            // ... light on room
            session.send("Turning on the lights on the '%s'.", results.response);
        } else {
            session.send("Sorry cannot do that...");
        }
    }
]);


intents.onDefault([
    function (session, results) {
        session.send('Sorry, I dont understand... can you rephrase?');
    }
]);
