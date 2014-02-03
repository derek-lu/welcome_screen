/**
 * Displays the iphone login form.
 */
var ADOBE = ADOBE || {};

ADOBE.LoginForm = Backbone.View.extend({
	tagName:  "div",
	
	className: "login",
	
	initialize: function() {
		var html  = "<div class='header'>";
			html +=		"<div id='title'>Sign In</div>";
		    html +=    "<div class='text-link' id='login-done-button'>Cancel</div>";
		    html += "</div>";
			html += "<form>";
		    html +=    "<input id='username' type='email' name='username' placeholder='Username'/>";
		    html +=    "<input id='password' type='password' name='password' placeholder='Password'/>";
		    html +=    "<div class='text-link' id='submit'>Submit</div>";
			html +=    "<div class='error'></div>";
			html += "</form>";
		
		if (ADOBE.Config.FORGOT_PASSWORD_URL != "")
		    html +=    "<div class='text-link' id='forgot-password'>Forgot password?</div>";
		
		if (ADOBE.Config.CREATE_ACCOUNT_URL != "")
		    html +=    "<div class='text-link' id='create-account'>Create an Account</div>";

		this.template = _.template(html);
	},
	
	render: function() {
		this.$el.html(this.template());
		
		var scope = this;
		this.$el.find("#login-done-button").on("click", function() { scope.close() });
		this.$el.find("#submit").on("click", function() { scope.submit_clickHandler() });
		this.$el.css("height", window.innerHeight);
		this.$el.css("top", window.innerHeight);
		
		this.$el.find("#forgot-password").on("click", function() { adobeDPS.dialogService.open(ADOBE.Config.FORGOT_PASSWORD_URL); });
		this.$el.find("#create-account").on("click", function() { adobeDPS.dialogService.open(ADOBE.Config.CREATE_ACCOUNT_URL); });
		
		
		// Need a delay so the transition is visible.
		setTimeout(function() {
			scope.$el.css("-webkit-transform", "translateY("+ -window.innerHeight + "px)");
		}, 10);
		
		return this;
	},
	
	close: function() {
		var scope = this;
		this.$el.css("-webkit-transform", "translateY(0px)");
		this.$el.one("webkitTransitionEnd", function(){ scope.$el.remove() });
	},
	
	// Handler for when a user clicks the submit button.
	submit_clickHandler: function() {
		var $username = this.$el.find("#username");
		var $password = this.$el.find("#password");
		$username.css("border-color", "#BBBBBB");
		$password.css("border-color", "#BBBBBB");
		
		// Make sure username and password are not blank.
		if ($username.val() == "" || $("#password").val() == "") {
			if ($username.val() == "")
				$username.css("border-color", "rgb(255,0,0)"); // Show an error state.
			
			if ($password.val() == "")
				$password.css("border-color", "rgb(255,0,0)"); // Show an error state.
		} else {
			// Login using the authenticationService.
			var transaction = adobeDPS.authenticationService.login($username.val(), $password.val());
			transaction.completedSignal.addOnce(function(transaction) {
				var transactionStates = adobeDPS.transactionManager.transactionStates;
				if (transaction.state == transactionStates.FAILED) {
					this.$el.find(".error").html("Authentication failed.")
				} else if (transaction.state == transactionStates.FINISHED){
					this.$el.trigger("loginSuccess");
					this.close();
				}
			}, this);
		}
	}
	
});
