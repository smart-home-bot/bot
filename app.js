var appInsights = require("applicationinsights");
appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY).start();
var appInsightsClient = appInsights.getClient();

var request = require('request');
var currentTime = '1400';
var clientSession;

var lightsSuggest = false;

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

server.post('/api/turnac', function (req, res, next) {
    if (req.headers.appPassword == connector.appPassword) {
        // Create a message and send it to the IoT Hub
        var data = JSON.stringify({ Name: 'TurnAC', Parameters: { TurnOn: true } });
        var message = new iotMessage(data);
        message.ack = 'full';
        message.messageId = 'TurnAC';
        console.log('Sending message: ' + message.getData());
        iotClient.send(iotTargetDevice, message, printResultFor('send'));
        res.send(200, "AC turned on");
    } else {
        res.send(401, "unauthorized access");
    }
    return next();

});


//=========================================================
// Bots Dialogs
//=========================================================

var recognizer = new botBuilder.LuisRecognizer('https://api.projectoxford.ai/luis/v2.0/apps/ac796f55-1f98-42e6-a069-53a34e0bbfb9?subscription-key=f73dec2a56024cf389e417b50d7d594a&verbose=true');
var intents = new botBuilder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', intents);

bot.dialog('/lightsSuggest', [
    function (session) {
        botBuilder.Prompts.choice(session, 'twilight will start soon, whould you like to turn on the lights?', ['yes', 'no']);
    },
    function (session, results) {
        var answer = results.response.entity;
        if (answer == 'yes') {
            session.send("Okay, turning all the lights on for you");

            // Create a message and send it to the IoT Hub
            var data = JSON.stringify({ Name: 'TurnLightsInRoom', Parameters: { Room: 'all', TurnOn: true } });
            var message = new iotMessage(data);
            message.properties.add("Address", JSON.stringify(session.message.address));
            message.ack = 'full';
            message.messageId = 'TurnLightsInRoom';
            console.log('Sending message: ' + message.getData());
            iotClient.send(iotTargetDevice, message, printResultFor('send'));
        }
        session.endDialog();
    }
]);

var rooms = ['kitchen', 'terrace', 'livingroom', "boy's room", 'bedroom', 'bathroom', "girl's room", "all"];
var actions = ["turn on the lights", "turn off the lights", "get the temperature"];

setInterval(function () {

    request('http://botmlservice.azurewebsites.net/api/lights/kitchen/' + currentTime, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            if (body == 'true' && clientSession && !lightsSuggest) {
                clientSession.beginDialog('/lightsSuggest');
                lightsSuggest = true;
            }
        }
    })

}, 40000);


intents.matches('SetCurrentTime', [
    function (session, args, next) {
        var timeObj = botBuilder.EntityRecognizer.findEntity(args.entities, 'Time');
        var time = timeObj.entity.replace(/[ :]/g, "");
        session.send("setting time to '%s'", time);
        currentTime = time;
        clientSession = session;
        lightsSuggest = false;
    }
]);

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
            if (room == 'all') {
                session.send("Turning all the lights on.");
            }
            else {
                session.send("Turning on the lights on the '%s'.", room);
            }
            // Create a message and send it to the IoT Hub
            var data = JSON.stringify({ Name: 'TurnLightsInRoom', Parameters: { Room: room, TurnOn: true } });
            var message = new iotMessage(data);
            message.properties.add("Address", JSON.stringify(session.message.address));
            message.ack = 'full';
            message.messageId = 'TurnLightsInRoom';
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
            if (room == 'all') {
                session.send("Turning all the lights off.");
            }
            else {
                session.send("Turning off the lights on the '%s'.", room);
            }
            // Create a message and send it to the IoT Hub
            var data = JSON.stringify({ Name: 'TurnLightsInRoom', Parameters: { Room: room, TurnOn: false } });
            var message = new iotMessage(data);
            message.properties.add("Address", JSON.stringify(session.message.address));
            message.ack = 'full';
            message.messageId = 'TurnLightsInRoom';
            console.log('Sending message: ' + message.getData());
            iotClient.send(iotTargetDevice, message, printResultFor('send'));
        } else {
            session.send("Sorry can't do that...");
        }
    }
]);


intents.matches('TurnOnAC', [
    function (session, args, next) {
        session.send("Turning AC on.");
        // Create a message and send it to the IoT Hub
        var data = JSON.stringify({ Name: 'TurnAC', Parameters: { TurnOn: true } });
        var message = new iotMessage(data);
        message.properties.add("Address", JSON.stringify(session.message.address));
        message.ack = 'full';
        message.messageId = 'TurnAC';
        console.log('Sending message: ' + message.getData());
        iotClient.send(iotTargetDevice, message, printResultFor('send'));
    }
]);

intents.matches('TurnOffAC', [
    function (session, args, next) {
        session.send("Turning AC off.");
        // Create a message and send it to the IoT Hub
        var data = JSON.stringify({ Name: 'TurnAC', Parameters: { TurnOn: false } });
        var message = new iotMessage(data);
        message.properties.add("Address", JSON.stringify(session.message.address));
        message.ack = 'full';
        message.messageId = 'TurnAC';
        console.log('Sending message: ' + message.getData());
        iotClient.send(iotTargetDevice, message, printResultFor('send'));
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
        var msgObj = JSON.parse(feedbackData.toString('utf-8'))[0];
        console.log(feedbackData.toString('utf-8'));
        var msg = new botBuilder.Message()
            .address(msgObj.Address)
            .text(msgObj.Name);
        bot.send(msg);
    });

    receiver.on('error', function (msg) {
        console.log('Feedback error:' + msg);
    });
}
