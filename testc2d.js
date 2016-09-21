'use strict';

var Client = require('azure-iothub').Client;
var Message = require('azure-iot-common').Message;

var connectionString = process.env.IOTHUB_CONNECTION_STRING || 'HostName=smart-home-bot.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=uSofgh7mnmRzkzDNReZf9OQ87dbtNv5XxEovN08u5so=';
var targetDevice = 'HomeIotGateway';

var client = Client.fromConnectionString(connectionString);


client.open(function (err) {
    if (err) {
        console.error('Could not connect: ' + err.message);
    } else {
        console.log('Client connected');
        client.getFeedbackReceiver(receiveFeedback);

        // Create a message and send it to the IoT Hub every second
        var data = JSON.stringify({ text: 'foo' });
        var message = new Message(data);
        message.ack = 'full';
        message.messageId = 'TurnOnLightsInRoom';
        console.log('Sending message: ' + message.getData());
        client.send(targetDevice, message, printResultFor('send'));
    }
});

// Helper function to print results in the console
function printResultFor(op) {
    return function printResult(err, res) {
        if (err) {
            console.log(op + ' error: ' + err.toString());
        } else {
            console.log(op + ' status: ' + res.constructor.name);
        }
    };
}


function receiveFeedback(err, receiver) {
    receiver.on('message', function (msg) {
        console.log('Feedback message:');
        var feedbackData = msg.getData();
        console.log(feedbackData.toString('utf-8'));
    });
    receiver.on('error', function (msg) {
        console.log('Feedback error:' + msg);
    });

}
