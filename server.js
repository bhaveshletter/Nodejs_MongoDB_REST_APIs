var http = require('http'),
url = require('url'),
Router = require('routes'),
router = new Router(),
bcrypt = require('bcryptjs'),
objectId = require('mongodb').ObjectID,
//  Custom modules
utils = require('./utils'),
constants = require('./constants.json'),
serverConst = constants.server;
dbConfig = require('./dbConfig');

//  Default routes of application with API version.
router.addRoute('/store/*?', authentication);
router.addRoute('/login', login);
router.addRoute('/logout', logout);
router.addRoute('/store/products', createSearch);
router.addRoute('/store/products/:id', showUpdateDelete);

//  Authorized each request before proceed toward actual destination except login & logout.
function authentication(req, res, match){
	utils.logInfo('authentication');

	var loginedUser = req.getCookie('email');
	checkUser(res, loginedUser, true, function(result){
		match = match.next();
		if (match){
			products = collections.collection('products');
			match.fn(req, res, match);
		}else{
			badRequest(res);
		}
	})
}

// Create server to serve request/response. Every request passes through.
var server = http.createServer(function (req, res) {
	utils.logInfo('http.createServer');

	res.statusCode = 200;
	res.setHeader("Content-Type", "application/json");

	var path = url.parse(req.url).pathname,
	match = router.match(path);
	utils.logInfo(match);
	if(match){
		match.fn(req, res, match);
	}else{
		badRequest(res);
	}
});

// Login and validate user. Creates cookie with current user email.
function login(req, res, match) {
	utils.logInfo('login');

	if(req.method == 'POST'){
		var body = '';

		req.on('data', function (data) {
			body = JSON.parse(data);
		});

		req.on('end', function () {
			if(body.email && body.password){
				checkUser(res, body.email, false, function(result){
					if(bcrypt.compareSync(body.password, result.password)){
						res.setCookie('email', body.email, 1);
						res.end(JSON.stringify({status: 200, message: 'Success, Login', result: {data: [result], total: 1}}));
					}else{
						res.end(JSON.stringify({status: 404, message: 'Sorry, Wrong Password', result: {}}));
					}
				});
			}else{
				res.end(JSON.stringify({status: 404, message: 'Sorry, Not Required Parameter(s)', result: {}}));
			}
		});
	}else{
		badRequest(res);
	}
}

// Clear cookie just after logout by valid user request
function logout(req, res, match) {
	utils.logInfo('logout');

	var loginedUser = req.getCookie('email');

	if(loginedUser && req.method == 'POST'){
		checkUser(res, loginedUser, false, function(result){
			res.setCookie('email', null);
			res.end(JSON.stringify({status: 200, message: "Success, Logout", result: {}}));
		});
	}else{
		badRequest(res);
	}
}

//  Validate & Insert new product
function create(req, res, match){
	utils.logInfo('create');

	beforeCreateUpdate(req, res, function(reqData){
		products.insertOne(reqData, function(err, result){
			utils.logError(err);
			res.end(JSON.stringify({status: 200, message: 'Success, Inserted.', result: {}}));
		});
	});
}

//  Find requested product base on valid product id.
function show(req, res, match) {
	utils.logInfo('show');

	var id = match.params.id;
	validateMongoId(res, id, function(validId){
		products.findOne({_id: validId}, function(err, result){
			utils.logError(err);
			checkAfterFind(res, result, function(resultFound){
				res.end(JSON.stringify({status: 200, message: 'Found', result: {data: [resultFound], total: 1}}));
			});				
		});
	});
}

//  Validate & Update existing product
function update(req, res, match) {
	utils.logInfo('update');

	var id = match.params.id;
	validateMongoId(res, id, function(validId){
		beforeCreateUpdate(req, res, function(reqData){
			products.findOneAndUpdate({_id: validId}, {$set: reqData}, function(err, result){
				utils.logInfo(err);
				checkAfterFind(res, result, function(resultFound){
					res.end(JSON.stringify({status: 200, message: 'Success, Updated', result: {}}));
				});
			});
		});
	});
}

//  Delete existing product if it's there.
function _delete(req, res, match) {
	utils.logInfo('_delete');

	var id = match.params.id;
	validateMongoId(res, id, function(validId){
		products.findOneAndDelete({_id: validId}, function(err, result){
			utils.logError(err);
			checkAfterFind(res, result, function(resultFound){
				res.end(JSON.stringify({status: 200, message: "Success, Deleted", result: {}}));
			});
		});
	});
}

// List products with given limit.
function index(req, res, match) {
	utils.logInfo('index');

	var searchParams = url.parse(req.url, true).query;
	var startFrom = parseInt(searchParams.from) || 0;
	var limitTo = parseInt(searchParams.limit) || 5;

	products.find({}).skip(startFrom).limit(limitTo).toArray(function(err, result) {
		utils.logError(err);
		products.count({}, function(err, total){
			utils.logError(err);
			res.end(JSON.stringify({status: 200, message: 'Success, List', result: {items: result, startFrom: startFrom, limit: limitTo, total: total}}));
		});
	});
}

//  Forward request base on http method for add new or find product.
function createSearch(req, res, match){
	utils.logInfo('createSearch');

	if(req.method === 'GET'){
		index(req, res, match);
	}else if(req.method === 'POST'){
		create(req, res, match);
	}else{
		badRequest(res);
	}
}

//  Forward request base on http method for single product for show, edit or remove a product.
function showUpdateDelete(req, res, match){
	if(req.method === 'GET'){
		show(req, res, match);
	}else if(req.method === 'PUT' || req.method === 'POST'){
		update(req, res, match);
	}else if(req.method === 'DELETE'){
		_delete(req, res, match);
	}else{
		badRequest(res);
	}
}

// Validate request's parameters  of a to be  updated or created product.
function beforeCreateUpdate(req, res, callback){
	utils.logInfo('beforeCreateUpdate');
	var body = '';

	req.on('data', function (data) {
		body = JSON.parse(data);
	});

	req.on('end', function (){  
		body.price = parseInt(body.price);
		if(body.name && body.code && body.price){    
			body.author = req.getCookie('email');
			callback(body);
		}else{
			res.end(JSON.stringify({status: 404, message: 'Sorry, Inadequate Parameter(s)', result: {}}));
		}
	});
}

// Check a product found or not.
function checkAfterFind(res, result, callback){
	if(result || result.value){
		callback(result);
	}else{
		res.end(JSON.stringify({status: 404, message: 'Sorry, Not Found', result: {}}));
	}
}

// Before making actual find, delete, update we must check given product id is valid.
function validateMongoId(res, id, callback){
	if(objectId.isValid(id)){
		callback(objectId(id))
	}else{
		res.end(JSON.stringify({status: 404, message: 'Sorry, Invalid Param', result: {}}));
	}
}

//  Base on user email check respected user is present or not.
function checkUser(res, email, fromAuthorization, callback){
	var users = collections.collection('users');
	users.findOne({email: email}, function(err, result){
		utils.logError(err);
		if(result){
			callback(result);
		}else if(fromAuthorization){
			res.end(JSON.stringify({status: 401, message: 'Sorry, Not Authorised', result: {}}));
		}
		else{
			res.end(JSON.stringify({status: 404, message: 'Sorry, Not Found', result: {}}));
		}		
	});
}

function badRequest(res){
	res.end(JSON.stringify({status: 400, message: 'Sorry, Bad request', result: {}}));
}

// Get cookie base on given key from all cookie.
http.IncomingMessage.prototype.getCookie = function(name) {
	var cookies;
	cookies = {};
	this.headers.cookie && this.headers.cookie.split(';').forEach(function(cookie) {
		var parts;
		parts = cookie.split('=');
		cookies[parts[0].trim()] = (parts[1] || '').trim();
	});
	return cookies[name] || null;
}

//  Set cookie if it's not exist.
http.OutgoingMessage.prototype.setCookie = function(name, value, exdays, domain, path) {
	var cookieText, cookies, exdate;
	cookies = this.getHeader('Set-Cookie');
	if (typeof cookies !== 'object') {
		cookies = [];
	}
	exdate = new Date();
	exdate.setDate(exdate.getDate() + exdays);
	cookieText = name + '=' + value + ';expires=' + exdate.toUTCString() + ';';
	if (domain) {
		cookieText += 'domain=' + domain + ';';
	}
	if (path) {
		cookieText += 'path=' + path + ';';
	}
	cookies.push(cookieText);
	this.setHeader('Set-Cookie', cookies);
}

server.listen(serverConst.PORT, serverConst.URL);
utils.logInfo('Server running at http://' + serverConst.URL + " and port " + serverConst.PORT);