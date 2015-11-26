var mongoClient = require('mongodb').MongoClient,
forEach = require('async-foreach').forEach,
bcrypt = require('bcryptjs');

//  Custom modules
var dbConst = require('./constants.json').db;
utils = require('./utils');

//  Connection URL. This is where mongodb server is running.
var dbURL = 'mongodb://' + dbConst.URL + ':' + dbConst.PORT + '/' + dbConst.NAME;

//  Method to connect the Server.
//  Create default users if not exist with encrypted password.
var dbConnect = mongoClient.connect(dbURL, function (err, db) {
	if (err) {
		utils.logError('Unable to connect the mongoDB server.');
		utils.logError(err);
	}else{
		utils.logInfo('Database connected at ' + dbURL);
		var usersCollection = db.collection('users'),
		usersList = [{email: 'user1@mailcatch.com', password: 'user1'}, {email: 'user2@mailcatch.com', password: 'user2'}, {email: 'user3@mailcatch.com', password: 'user3'}];

		forEach(usersList, function(item, index, arr){
			usersCollection.findOne({email: item.email}, function(err, result){
				utils.logInfo(err);
				if(!result){
					var salt = bcrypt.genSaltSync(10);
					hash = bcrypt.hashSync(item.password, salt);
					item.password = hash;
					usersCollection.insertOne(item, function(err, NewUser) {
						utils.logInfo("User created. email: " + item.email);
					});
				}
			});
		}, function(notAborted){
			if(notAborted){
				utils.logInfo("All were well during User(s) creation.");
			}else{
				utils.logError("Something went wrong before User(s) creation.");
			}
		});

		collections = db;
	}
});

module.export = dbConnect;