//  Log error messages.
module.exports.logError = function(err){
	console.error("!!!!! ERROR !!!!!");
	console.error(err);
}

//  Log non error messages.
module.exports.logInfo = function(msg){
	console.info("***** INFO *****");
	console.info(msg);
}