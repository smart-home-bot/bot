'use strict';

var Client = require('azure-iothub').Client;
var Message = require('azure-iot-common').Message;

var connectionString = 'HostName=smart-home-bot.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=uSofgh7mnmRzkzDNReZf9OQ87dbtNv5XxEovN08u5so=';
var targetDevice = 'HomeIotGateway';

var client = Client.fromConnectionString(connectionString);

client.open(function (err) {
  if (err) {
    console.error('Could not connect: ' + err.message);
  } else {
    console.log('Client connected');

    // Create a message and send it to the IoT Hub every second
    setInterval(function () {
      var data = JSON.stringify({ text : 'foo' });
      var message = new Message(data);
      console.log('Sending message: ' + message.getData());
      client.send(targetDevice, message, printResultFor('send'));
    }, 2000);
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