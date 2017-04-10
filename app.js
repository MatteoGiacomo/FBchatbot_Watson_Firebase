var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var routes = require('./routes/index');
var users = require('./routes/users');
var firebase = require('firebase');

var _ = require('underscore');

var app = express();
var request = require('request');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);


// Facebook account settings
var token = "_____YOUR_FACEBOOK_TOKEN_________";
var profileUser = new Object();


// Watson account settings 
var watson = require('watson-developer-cloud');
var workspaceId = '____YOUR_WATSON_ID_WORKSPACE____';
var conversation = watson.conversation({
  username: '____YOUR_WATSON_USERNAME____',
  password: '____YOUR_WATSON_PASSWORD____',
  version: 'v1',
  version_date: '2016-09-20'
});
var contextResponse = {};
var risposta ='';


// Firebase account settings
var config = {
	apiKey: "____YOUR_FIREBASE_CONFIG____",
	authDomain: "____YOUR_FIREBASE_CONFIG____",
	databaseURL: "____YOUR_FIREBASE_CONFIG____",
	storageBucket: "____YOUR_FIREBASE_CONFIG____"
};

firebase.initializeApp(config);

// Database reference configuration
var database = firebase.database();
var refDB = firebase.database().ref('stories/');

var messageInit = "sono Folk,\r\nmi piace raccontare o ascoltare storie\r\n\r\nPer capire meglio prova a guardare il menù qua sotto e prova subito.";
var messageHelp = "FolkStory è una community di cantastorie.\r\n\r\nLo scopo è raccontare una storia con persone che non si conoscono.\r\nSi hanno 30 SECONDI di tempo per dire il proprio capitolo.\r\n\r\nper maggiori informazioni:";
var message_myStoriesYes = "Ecco i tuoi episodi";
var message_noStories = "Purtroppo non abbiamo trovato storie.";



// =========== IBM WATSON ===========

/**
 * conversationWatson send information to your Watson Conversation workspace where you can set context, dialogues etc ... 
 * @param  {string} textMessage: text from users 
 * @return {Object}         object with response text, conversation context and dialogue nodes
 */
function conversationWatson (textMessage, context, recipientId){
	conversation.message({
			workspace_id: workspaceId,
			input: {'text': textMessage},
			context: context
		}, function(err, response) {
			if (err)
				console.log('error:', err);
			else {
				risposta = response.output.text[0];
				contextResponse = response.context;
				console.log (contextResponse)
				sendTextMessage(recipientId, risposta);

			}
	});
}


// =========== FIREBASE ===========

/**
 * saveAudioStory add data to firebase database
 * @param  {string} userId   facebook Id of sender user
 * @param  {[type]} name     facebook name of sender user
 * @param  {[type]} audioUrl url of audio with story saved on facebook storage
 */
function saveAudioStory (userId, audioUrl) {
  firebase.database().ref('stories').push({
    senderId: userId,
    audio : audioUrl
  });
}


// =========== FACEBOOK MESSENGER ===========

/**
 * sendTextMessage: text a message to user
 * @param  integer recipientId: user_id 
 * @param  string messageText: text to send
 * @param  {Function} cb: callback to send another message 
 */
function sendTextMessage(recipientId, messageText, cb) {

	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: messageText
		}
	};

	callSendAPI(messageData, cb);
}


/**
 * sendAudio: send an audio message from an url assigned 
 * @param  {integer}  recipientId:  user ID
 * @param  {string}   audioUrl:  url to audio message
 * @param  {Function} cb: callback to send another message
 */
function sendAudio(recipientId, audioUrl, cb) {

	var messageData = {
		recipient: {
    		id: recipientId
  		},
  		message: {
    		attachment: {
      			type:'audio',
      			payload: {
        			url: audioUrl
      			}
    		}
  		}
	};

	callSendAPI(messageData, cb);
}


/**
 * sendQuickReplies permit users to choose options trough buttons
 * @param  integer  user_id
 * @param  string  messege to display before quick_reply
 * @param  string  first choise displaied 
 * @param  string  second choise displaied
 * @param  string  third choise displaied
 * @param  string  name of response which identify the first choise
 * @param  string  name of response which identify the second choise
 * @param  string  name of response which identify the third choise
 * @param  {Function} callback
 * @return string response from the choise made by the users 
 */
function sendQuickReplies(recipientId, quick_text, first_reply, second_reply, third_reply, first_payload, second_payload, third_payload, cb) {
	if (third_reply && third_payload)
	{
		var messageData = {
			recipient: {
				id: recipientId
			},
			message: {
				text: quick_text,
				quick_replies: [
				{
					content_type :"text",
					title : first_reply,
					payload : first_payload
				},
				{
					content_type :"text",
					title : second_reply,
					payload : second_payload
				},
				{
					content_type :"text",
					title : third_reply,
					payload : third_payload
				}
				]
			}
		};
	}

	if (!third_reply && !third_payload)
	{
		var messageData = {
			recipient: {
				id: recipientId
			},
			message: {
				text: quick_text,
				quick_replies: [
				{
					content_type :"text",
					title : first_reply,
					payload : first_payload
				},
				{
					content_type :"text",
					title : second_reply,
					payload : second_payload
				}
				]
			}
		};
	}

	callSendAPI(messageData, cb);
}


/**
 * [sendMessageButton description]
 * @param  {Function} cb [description]
 * @return {[type]}      [description]
 */
function sendMessageButton(recipientId, message, labelBtn, urlSite){

	var messageData = {
		recipient:{
    		id: recipientId
  		},
  		message:{
    		attachment:{
      			type:"template",
      			payload:{
        			template_type:"button",
        			text: message,
	        		buttons:[{
	            		type:"web_url",
	            		url: urlSite,
	            		title: labelBtn
	          		}]
      			}
    		}
  		}
	};
	callSendAPI(messageData);
}

/**
 * sendTamplateMessage: permit to send a message in a tamplate with an image, title, and buttons with CTA 
 * @param  {integer} recipientId: id of the user that recived the message
 */
function sendTamplateMessage(recipientId, label, subtitle, urlImage, payload, labelBtn, type) 
{
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: type,
          elements: [{
            title: label,
            subtitle: subtitle,
            // item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: urlImage,
            buttons: [{
              type: "postback",
              payload: payload,
              title: labelBtn
            }]
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}


/**
 * callSendAPI: permit to comunicate with Facebook and sending data.
 * @param  {Object}   messageData: contain the user Id, typology and the content of message 
 * @param  {Function} cb : permit to concat another message 
 * @return {message} IN CONSOLE return if the message was delivered or error
 */
function callSendAPI(messageData, cb) 
{
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messages',
		qs: { access_token: token },
		method: 'POST',
		json: messageData
	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var recipientId = body.recipient_id;
			var messageId = body.message_id;
			console.log("Successfully sent generic message with id %s to recipient %s", messageId, recipientId);
			if (cb) {
				cb(undefined, messageId);
			}
		} else {
			console.error("Unable to send message.");
			console.error(response.body);
		}
	});
}


/**
 * CONNECTION WITH WEBHOOK FACEBOOK
 */
app.get('/webhook', function (req, res) {
	if (req.query['hub.verify_token'] === token) {
	  res.send(req.query['hub.challenge']);
	} else {
	  res.send('Error, wrong validation token');    
	}
});


app.post('/webhook', function (req, res) {
	
	if (req.body.entry[0].messaging[0]) {

		var recipientId = req.body.entry[0].messaging[0].sender.id;
		var urlProfile = "https://graph.facebook.com/v2.6/"+ recipientId +"?access_token=" + token;

		request.get(urlProfile, function(e,r,body){

			profileUser = JSON.parse(body);
			var payload;

			// postBack
			if (req.body.entry[0].messaging[0].postback) {
				payload = req.body.entry[0].messaging[0].postback.payload;
			};

			// START BUTTON
			if (payload == 'get_started') {

				sendTextMessage(recipientId, 'Ehi ' + profileUser.first_name + ' !' , function(){
						sendTextMessage(recipientId, messageInit);
				});
			};

			// MENU
			// _new story
			if (payload == 'new_story'){

				// WORK IN PROGRESS 
				sentTextMessage(recipientId, "Come chiamiamo la sotria ?")
				sendTextMessage(recipientId, messageInit);
			};

			// _ascolta storia 
			if (payload == 'listen_story') {
				// WORK IN PROGRESS
				refDB.orderByChild('senderId').equalTo(recipientId).on("child_added", function(snapshot) {
				  var username = snapshot.val();
				  sendAudio(recipientId, username.audio.url);
				  
				});
			};

			//_continua una storia
			if (payload == 'add_chapter') {
				// WORK IN PROGRESS
				sendTextMessage(recipientId, messageInit);
			};

			//_le mie storie
			if (payload == 'my_stories') {
				// WORK IN PROGRESS
				refDB.orderByChild('senderId').equalTo(recipientId).on("value", function(snapshot) {

				  if (snapshot.exists()) {
				  	snapshot.forEach( function(child){
				  		// sendAudio(recipientId, username.audio.url);
				  		if (payload !== 'undefined') {
				  			sendTextMessage(recipientId, child.val().audio);
				  		}
				  		console.log ('SONO DENTRO IL CICLO FOR');
				  		
				  	});
				  }  

				  if (!snapshot.exists()){
				  	// WORK IN PROGRESS
					// TODO refactor
				 	var messageData = {
					    recipient: {
					      id: recipientId
					    },
					    message: {
					      attachment: {
					        type: "template",
					        payload: {
					          template_type: "generic",
					          elements: [{
					            title: "RACCONTA LE TUE GESTA",
					            subtitle: "Siamo eterni oratori e curiosi ascoltatori alla ricerca di un sorriso",
					            image_url: "http://www.ilpost.it/wp-content/uploads/2015/08/Le-Corbusier_36.jpg", 
					            buttons: [{
					              type: "postback",
					              payload: "new_story",
					              title: "Inizia una Storia"
					            }]
					          },
					          {
					            title: "LASCIATI ISPIRARE",
					            subtitle: "Continua un racconto chè è già iniziato e dagli il tuo tocco personale",
					            image_url: "http://www.ilpuntoh.com/wp-content/uploads/2016/07/New-York.jpg", 
					            buttons: [{
					              type: "postback",
					              payload: "new_story",
					              title: "Continua una Storia"
					            }]
					          }]
					        }
					      }
					    }
					  };
					  callSendAPI(messageData);
				  }
				});
			};

			//_aiuto
			if (payload == 'help'){
				var labelBtn = "Visita il sito";
				var urlSite= "http://www.google.com/";
				sendMessageButton(recipientId, messageHelp, labelBtn, urlSite);
			}

			if (payload == 'CATEGORIES[0].type'){
			}

			 
			if (payload == 'CATEGORIES[1].type'){
			}

			
			if (payload == 'CATEGORIES[2].type'){
			}

			 
			if (payload == 'CATEGORIES[3].type'){
			}

			 
			if (payload == 'CATEGORIES[4].type'){
			}

			 
			if (payload == 'CATEGORIES[5].type'){
			}


			if (req.body.entry[0].messaging[0].message) {

				// message: quick_reply 
				if (req.body.entry[0].messaging[0].message.quick_reply){
					payload = req.body.entry[0].messaging[0].message.quick_reply.payload;
				}

				// message: text
				if (req.body.entry[0].messaging[0].message.text) {
					conversationWatson(req.body.entry[0].messaging[0].message.text, contextResponse, recipientId);
				}

				// message: audio, photo, video
				if (req.body.entry[0].messaging[0].message.attachments){

					 if (req.body.entry[0].messaging[0].message.attachments[0].type == 'audio') {
						// if the message is an audio message, it will be saved in Firebase
					 	var audioUrl = req.body.entry[0].messaging[0].message.attachments[0].payload;
						saveAudioStory(recipientId, audioUrl);

					}
				}
			};

		});

		res.status(200).end();
	}
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});


// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		res.status(200);
		console.log(err);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
};


module.exports = app;

