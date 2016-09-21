var appInsights = require("applicationinsights");
appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY).start();
var appInsightsClient = appInsights.getClient();

var restify = require('restify');
var botBuilder = require('botbuilder');

var iotClientModule = require('azure-iothub').Client;
var iotMessage = require('azure-iot-common').Message;
var iotConnectionString = process.env.IOTHUB_CONNECTION_STRING || 'HostName=smart-home-bot.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=uSofgh7mnmRzkzDNReZf9OQ87dbtNv5XxEovN08u5so=';

var iotTargetDevice = 'HomeIotGateway';
var iotClient = iotClientModule.fromConnectionString(iotConnectionString);

iotClient.open(function (err) {
    if (err) {
        console.error('Could not connect: ' + err.message);
    } else {
        console.log('Client connected');
        iotClient.getFeedbackReceiver(receiveFeedback);
    }
});

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new botBuilder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID || '95d70bbf-09d8-4410-974d-dbad41d36c98',
    appPassword: process.env.MICROSOFT_APP_PASSWORD || 'R4Mppn5yQxoeD0efBe9TCTG'
});
var bot = new botBuilder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Bots Dialogs
//=========================================================

var recognizer = new botBuilder.LuisRecognizer('https://api.projectoxford.ai/luis/v1/application?id=ac796f55-1f98-42e6-a069-53a34e0bbfb9&subscription-key=c378bb10282c40818fdcce7ffb865b17');
var intents = new botBuilder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', intents);

var rooms = ["kitchen", "bedroom", "livingroom", "toilets", "terace"];
var actions = ["turn on the lights", "turn off the lights", "get the temperature"];

intents.matches('TurnOnLightsInRoom', [
    function (session, args, next) {
        var room = botBuilder.EntityRecognizer.findEntity(args.entities, 'Room');
        if (!room) {
            botBuilder.Prompts.choice(session, "On which room would you like to turn on the lights?", rooms);
        } else {
            next({ response: room });
        }
    },
    function (session, results) {
        if (results.response) {
            // ... light on in room
            var room = results.response.entity;
            session.send("Turning on the lights on the '%s'.", room);
            // Create a message and send it to the IoT Hub every second
            var data = JSON.stringify({ Address: session.message.address, Name: 'TurnOnLightsInRoom', Parameters: { Room: room, TurnOn: true } });
            var message = new iotMessage(data);
            message.ack = 'full';
            message.messageId = 'TurnOnLightsInRoom';
            console.log('Sending message: ' + message.getData());
            iotClient.send(iotTargetDevice, message, printResultFor('send'));
        } else {
            session.send("Sorry can't do that...");
        }
    }
]);


intents.matches('TurnOffLightsInRoom', [
    function (session, args, next) {
        var room = botBuilder.EntityRecognizer.findEntity(args.entities, 'Room');
        if (!room) {
            botBuilder.Prompts.choice(session, "On which room would you like to turn off the lights?", rooms);
        } else {
            next({ response: room });
        }
    },
    function (session, results) {
        if (results.response) {
            // ... light off in room
            var room = results.response.entity;
            session.send("Turning off the lights on the '%s'.", room);
            // Create a message and send it to the IoT Hub every second
            var data = JSON.stringify({ Address: session.message.address, Name: 'TurnOffLightsInRoom', Parameters: { Room: room, TurnOn: false } });
            var message = new iotMessage(data);
            message.ack = 'full';
            message.messageId = 'TurnOffLightsInRoom';
            console.log('Sending message: ' + message.getData());
            iotClient.send(iotTargetDevice, message, printResultFor('send'));
        } else {
            session.send("Sorry can't do that...");
        }
    }
]);

intents.matches('GetTemperatureInRoom', [
    function (session, args, next) {
        var room = botBuilder.EntityRecognizer.findEntity(args.entities, 'Room');
        if (!room) {
            botBuilder.Prompts.choice(session, "On which room would you like to sample temperature?", rooms);
        } else {
            next({ response: room.entity });
        }
    },
    function (session, results) {
        if (results.response) {
            // ... get temperature in room
            session.send("Sampling temperature in room '%s'.", results.response.entity);
        } else {
            session.send("Sorry can't do that...");
        }
    }
]);




intents.onDefault(botBuilder.DialogAction.send('Sorry, I dont understand... can you rephrase?'));

function printResultFor(op) {
    return function printResult(err, res) {
        if (err) console.log(op + ' error: ' + err.toString());
        if (res) console.log(op + ' status: ' + res.constructor.name);
    };
}

function receiveFeedback(err, receiver) {
    receiver.on('message', function (msg) {
        console.log('Feedback message:');
        var feedbackData = msg.getData();
        console.log(feedbackData.toString('utf-8'));
        var msg = new botBuilder.Message()
            .address(feedbackData.Address)
            .text(feedbackData.Name);
        bot.send(msg);
    });

    receiver.on('error', function (msg) {
        console.log('Feedback error:' + msg);
    });
}
