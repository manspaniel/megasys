var mongojs = require('mongojs');
var async = require('async');

var ObjectID = mongojs.ObjectId;

var API = function(server) {
	
	var db = mongojs(process.env.MONGO_CONN || 'mongodb://localhost/megasys');
	
	var self = this;
	
	this.computers = db.collection('computers');
	this.users = db.collection('users');
	this.sessions = db.collection('sessions');
	
	// Indexes
	this.computers.ensureIndex({identifier:1});
	this.users.ensureIndex({username:1,password:1});
	
	var reservedUsernameRegex = /^(about|ac|access|account|accounts|activate|ad|add|address|adm|admin|administration|administrator|adult|advertising|ae|af|affiliate|affiliates|ag|ai|ajax|al|am|an|analytics|android|anon|anonymous|ao|api|app|apple|apps|aq|ar|arabic|archive|archives|as|at|atom|au|auth|authentication|avatar|aw|awadhi|ax|az|azerbaijani|ba|backup|banner|banners|bb|bd|be|bengali|better|bf|bg|bh|bhojpuri|bi|billing|bin|bj|blog|blogs|bm|bn|bo|board|bot|bots|br|bs|bt|burmese|business|bv|bw|by|bz|ca|cache|cadastro|calendar|campaign|cancel|careers|cart|cc|cd|cf|cg|cgi|ch|changelog|chat|checkout|chinese|ci|ck|cl|client|cliente|cm|cn|co|code|codereview|comercial|compare|compras|config|configuration|connect|contact|contest|cr|create|cs|css|cu|cv|cvs|cx|cy|cz|dashboard|data|db|dd|de|delete|demo|design|designer|dev|devel|dir|direct|direct_messages|directory|dj|dk|dm|do|doc|docs|documentation|domain|download|downloads|dutch|dz|ec|ecommerce|edit|editor|edits|ee|eg|eh|email|employment|english|enterprise|er|es|et|eu|exchange|facebook|faq|farsi|favorite|favorites|feed|feedback|feeds|fi|file|files|fj|fk|fleet|fleets|flog|fm|fo|follow|followers|following|forum|forums|fr|free|french|friend|friends|ftp|ga|gadget|gadgets|games|gan|gb|gd|ge|german|gf|gg|gh|gi|gist|git|github|gl|gm|gn|google|gp|gq|gr|group|groups|gs|gt|gu|guest|gujarati|gw|gy|hakka|hausa|help|hindi|hk|hm|hn|home|homepage|host|hosting|hostmaster|hostname|hpg|hr|ht|html|http|httpd|https|hu|id|idea|ideas|ie|il|im|image|images|imap|img|in|index|indice|info|information|intranet|invitations|invite|io|ipad|iphone|iq|ir|irc|is|it|italian|japanese|java|javanese|javascript|je|jinyu|jm|jo|job|jobs|jp|js|json|kannada|ke|kg|kh|ki|km|kn|knowledgebase|korean|kp|kr|kw|ky|kz|la|language|languages|lb|lc|li|list|lists|lk|local|localhost|log|login|logout|logs|lr|ls|lt|lu|lv|ly|ma|mail|mail1|mail2|mail3|mail4|mail5|mailer|mailing|maithili|malayalam|manager|mandarin|map|maps|marathi|marketing|master|mc|md|me|media|message|messenger|mg|mh|microblog|microblogs|min\-nan|mine|mis|mk|ml|mm|mn|mo|mob|mobile|mobilemail|movie|movies|mp|mp3|mq|mr|ms|msg|msn|mt|mu|music|musicas|mv|mw|mx|my|mysql|mz|na|name|named|nc|ne|net|network|new|news|newsletter|nf|ng|ni|nick|nickname|nl|no|notes|noticias|np|nr|ns|ns1|ns2|ns3|ns4|nu|nz|oauth|oauth_clients|offers|old|om|online|openid|operator|order|orders|organizations|oriya|pa|page|pager|pages|panel|panjabi|password|pda|pe|perl|pf|pg|ph|photo|photoalbum|photos|php|pic|pics|pk|pl|plans|plugin|plugins|pm|pn|polish|pop|pop3|popular|portuguese|post|postfix|postmaster|posts|pr|privacy|profile|project|projects|promo|ps|pt|pub|public|put|pw|py|python|qa|random|re|recruitment|register|registration|remove|replies|repo|ro|romanian|root|rs|rss|ru|ruby|russian|rw|sa|sale|sales|sample|samples|save|sb|sc|script|scripts|sd|se|search|secure|security|send|serbo\-croatian|service|sessions|setting|settings|setup|sftp|sg|sh|shop|si|signin|signup|sindhi|site|sitemap|sites|sj|sk|sl|sm|smtp|sn|so|soporte|spanish|sql|sr|ss|ssh|ssl|ssladmin|ssladministrator|sslwebmaster|st|stage|staging|start|stat|static|stats|status|store|stores|stories|styleguide|su|subdomain|subscribe|subscriptions|sunda|suporte|support|sv|svn|sy|sysadmin|sysadministrator|system|sz|tablet|tablets|talk|tamil|task|tasks|tc|td|tech|telnet|telugu|terms|test|test1|test2|test3|teste|tests|tf|tg|th|thai|theme|themes|tj|tk|tl|tm|tmp|tn|to|todo|tools|tour|tp|tr|translations|trends|tt|turkish|tv|tw|twitter|twittr|tz|ua|ug|uk|ukrainian|unfollow|unsubscribe|update|upload|urdu|url|us|usage|user|username|usuario|uy|uz|va|vc|ve|vendas|vg|vi|video|videos|vietnamese|visitor|vn|vu|weather|web|webmail|webmaster|website|websites|webstats|wf|widget|widgets|wiki|win|workshop|ws|wu|ww|wws|www|www1|www2|www3|www4|www5|www6|www7|wwws|wwww|xfn|xiang|xml|xmpp|xmppSuggest|xpg|xxx|yaml|ye|yml|yoruba|you|yourdomain|yourname|yoursite|yourusername|yt|yu|za|zm|zw)$/i;
	
	this.isUsernameValid = function(name, callback) {
		
		// Ensure it's valid
		if(!name || typeof name !== 'string') {
			callback(new Error("That username is invalid."));
			return;
		}
		
		// Ensure using correct characters
		if(name.match(/^[A-Z0-9\.\_\-]+$/i) === null) {
			callback(new Error("The username specified contains invalid characters."));
			return;
		}
		
		// Correct length
		if(name.length < 4) {
			callback(new Error("Your username must be at least 4 characters long."));
			return;
		}
		
		// Check that the name is actually valid
		if(reservedUsernameRegex.test(name)) {
			callback(new Error("That username is reserved and cannot be used."));
			return;
		}
		
		self.users.findOne({
			username: name
		}, function(err, doc) {
			if(err) return callback(new Error("DB error validating username."));
			if(doc) return callback(new Error("That username has already been taken."));
			callback(null, true);
		});
		
	};
	
	this.createAccount = function(data, callback) {
		
		data.dateRegistered = new Date();
		
		self.users.insert(data, function(err, doc) {
			callback(err && "There was a network error creating your account.", doc);
		});
		
	};
	
	this.verifyCredentials = function(data, callback) {
		
		self.users.findOne({
			username: data.username,
			password: data.password
		}, function(err, doc) {
			if(err) {
				callback("There was a network error verifying your login details.");
			} else {
				if(doc) {
					callback(null, doc);
				} else {
					callback("Sorry, the username and password you entered were incorrect.");
				}
			}
		});
		
	};
	
	this.validateSessionID = function(id, callback) {
		console.log("Vaidating...");
		self.sessions.findOne({_id:ObjectID(String(id))}, function(err, session) {
			console.log("Result");
			if(err) {
				console.log("Encountered error", err);
			} else {
				console.log("Session result", session);
			}
			if(session) {
				
				if(session.userID) {
					var requiresPassword = (new Date().getTime() - session.sessionEnd.getTime() > 10*60*1000);
					self.users.findOne({_id: session.userID}, function(err, doc) {
						if(doc) {
							callback(doc, requiresPassword);
						} else {
							callback();
						}
					});
				} else {
					callback();
				}
				
			} else {
				callback();
			}
		});
	};
	
	this.createSession = function(data, callback) {
		self.sessions.insert({
			sessionStart: new Date(),
			sessionEnd: new Date(),
			data: data
		}, function(err, item) {
			callback(item._id.toString());
		});
	};
	
	this.setSessionUser = function(sessionID, user) {
		console.log("Setting session user", sessionID, user);
		self.sessions.update({
			_id: new ObjectID(sessionID)
		}, {
			$set:{
				userID: user._id
			}
		}, function() {
		});
	};
	
	this.fetchComputerData = function(computerID, callback) {
		
		this.computers.findOne({
			identifier: computerID
		}, callback);
		
	};
	
	this.saveComputerData = function(computerID, computerData, callback) {
		
		this.computers.findAndModify({
			query: {
				identifier: computerID
			},
			update: {
				identifier: computerID,
				dateUpdated: new Date(),
				data: computerData
			},
			'new': true,
			upsert: true
		}, callback);
		
	};
	
};

module.exports = API;