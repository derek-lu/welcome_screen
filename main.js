$(document).ready(function() {
	// Removes the 300ms delay for click events.
	FastClick.attach(document.body);

	var folios;
	var previewFolios;

	var $progressBar = $("#progress-bar");

	var subscriptions;
	var subscriptionLabels;

	var spinner;

	var messaging = $("#messaging").html(); 
	
	adobeDPS.initializationComplete.addOnce(checkIsUserOnline);

	// To use this uncomment the textarea in index.html.
	// Helpful for debugging startup problems since a remote debug session might not be opened in time.
	window.debug = function(value) {
		$(".debug").val($(".debug").val() + ($(".debug").val() == "" ? "" : "\n") + value);
	}

	// The welcome screen does not display if the user is not online when they first install the app.
	// However, for updates the welcome screen will display if the user is not online.
	function checkIsUserOnline() {
		$.ajax({
			type: "HEAD",
			url: "http://stats.adobe.com/",
			success: function() {
				// Set the messaging again in case the user was not online.
				$("#messaging").html(messaging);

				// Options for the indeterminate spinner.
				var opts = {
						  lines: 13, // The number of lines to draw
						  length: 8, // The length of each line
						  width: 3, // The line thickness
						  radius: 7, // The radius of the inner circle
						  corners: 0, // Corner roundness (0..1)
						  rotate: 0, // The rotation offset
						  direction: 1, // 1: clockwise, -1: counterclockwise
						  color: '#fff', // #rgb or #rrggbb
						  speed: 1, // Rounds per second
						  trail: 60, // Afterglow percentage
						  shadow: false, // Whether to render a shadow
						  hwaccel: false, // Whether to use hardware acceleration
						  className: 'spinner', // The CSS class to assign to the spinner
						  zIndex: 8, // The z-index (defaults to 2000000000)
						  top: 0, // Top position relative to parent in px
						  left: -18 // Left position relative to parent in px
						};

				var target = document.getElementById("spinner");
				spinner = new Spinner(opts).spin(target);

				init();
			},
			error: function() {
				$("#messaging").html("Please connect to the internet.");
				// User is not online so wait for the deviceService to send an isOnline property.
				adobeDPS.deviceService.updatedSignal.add(function(properties) {
					if (properties.indexOf("isOnline") != -1 && adobeDPS.deviceService.isOnline) {
						adobeDPS.deviceService.updatedSignal.removeAll();
						checkIsUserOnline();
					}
				})
			}
		});
	}

	function init() {
		var transaction = adobeDPS.libraryService.updateLibrary();
		transaction.completedSignal.add(updateLibraryHandler);

		var isSubscriptionsAvailable = false;
		// Look for any subscriptions
		for (var s in adobeDPS.receiptService.availableSubscriptions) {
			var subscription = adobeDPS.receiptService.availableSubscriptions[s];
			if (subscription) {
				isSubscriptionsAvailable = true;
				break;
			}
		}

		// Displaying the buttons is set in Config.js to make it easier to update.
		// Make sure subs are available and check the config value to display the button.
		if (isSubscriptionsAvailable && ADOBE.Config.IS_SHOW_SUBSCRIBE_BUTTON)
			$("#subscribe-button").css("display", "block");

		if (ADOBE.Config.IS_SHOW_ITUNES_USER_BUTTON)
			$("#itunes-button").css("display", "block");

		if (ADOBE.Config.IS_SHOW_PRINT_SUBSCRIBER_BUTTON)
			$("#print-subscriber-button").css("display", "block");

		if (ADOBE.Config.IS_SHOW_STORE_BUTTON)
			$("#store-button").css("display", "block");
	}

	function updateLibraryHandler(transaction) {
		if (transaction)
			transaction.completedSignal.removeAll();

		folios = adobeDPS.libraryService.folioMap.sort(function (a, b) {
			return b.publicationDate - a.publicationDate
		});
 
 		// Double check to make sure folios are available. If not set a timeout to check again.
		if (folios.length == 0) {
			setTimeout(function() {
				updateLibraryHandler();
			}, 1500);
			return;
		}

		// Add the handlers for the buttons.
		$("#subscribe-button").on("click", subscribeButtonClickHandler);
		$("#print-subscriber-button").on("click", printSubscriberButtonClickHandler);
		$("#itunes-button").on("click", itunesButtonClickHandler);
		$("#store-button").on("click", storeButtonClickHandler);

		// Figure out if this app was updated rather than a fresh install.
		// Not foolproof but a guess based on whether or not there is an installed folio.
		var isInstallAnUpdate = false;
		var folioStates = adobeDPS.libraryService.folioStates;
		for (var i = 0; i < len; i++) {
			var folio = folios[i];
			if (folio.state == folioStates.INSTALLED) {
				isInstallAnUpdate = true;
				break;
			}
		}

		if (isInstallAnUpdate) {
			// Install is an update so display a link to go to the library.
			$("#spinner-container").hide();
			var html  = "<div id='go-to-library-button'>Go to library <div class='arrow-right-large'></div></div>";
			$("#messaging").html(html);

			$("#go-to-library-button").on("click", function() {
				adobeDPS.configurationService.gotoState("library");
				adobeDPS.dialogService.dismissWelcomeScreen();
			});

		} else {
			var folioToDownload;
			var len = folios.length;

			// The order of operation to download a folio is to first check for a promotional folio,
			// if one is not found then check for a folio with article preview, if nothing is found
			// then the first free folio is downloaded.

			// Loop through the folios to see if there is a promotional folio.
			// If one is found then start downloading it.
			for (var i = 0; i < len; i++) {
				if (folios[i].entitlementType == adobeDPS.receiptService.entitlementTypes.PROMOTIONAL) {
					folioToDownload = folios[i];
					isPromotionalFolioFound = true;
					break;
				}
			}

			if (!folioToDownload) { // Promotional folio was not found so look for the first one with a preview.
				previewFolios = folios.slice();
				findFirstPromotionalFolio();
			} else { // Promotional folio was found.
				if (folioToDownload.isDownloadable) { // If the folio is downloadable then start downloading it. This will most likely occur on a reinstall.
					var transaction = folioToDownload.download();
					addDownloadCallBacks(transaction, folioToDownload);
				} else if (folioToDownload.currentStateChangingTransaction()) { // Folio has already started to download so just add the download callbacks.
					// The download was triggered by the viewer which auto opens the folio so set
					// this to auto open so the welcome screen is removed when the folio is ready.
					ADOBE.Config.isAutoOpenDownloadedFolio = true;
					var transaction = folioToDownload.currentStateChangingTransaction();
					addDownloadCallBacks(transaction, folioToDownload);
				}
			}
		}
	}

	function isIPhone() {
		return navigator.userAgent.indexOf("iPhone") != -1;
	}

	// Handler for when a user clicks the subscribe button.
	function subscribeButtonClickHandler() {
		if (isIPhone()) { // On the iphone a slideup sheet of buttons is displayed.
			subscriptions = [];
			subscriptionLabels = [];

			// The text that is displayed at the top of the button sheet.
			var title = "Select a digital subscription option below. Your digital subscription will start immediately from the latest issue after you complete the purchase process.";
			var scope = this;
			var availableSubscriptions = adobeDPS.receiptService.availableSubscriptions;
			for (var s in availableSubscriptions) {
				var availableSubscription = availableSubscriptions[s];
				subscriptionLabels.push(availableSubscription.duration + " subscription for " + availableSubscription.price);
				subscriptions.push(availableSubscription);
			}

			$("body").buttonSheet({title: title, buttons: subscriptionLabels}).one("change", function(e, buttonIndex) {
				subscribeButtonSheet_changeHandler(buttonIndex);
			});
		} else { // On the ipad a dialog is displayed.
			var subscribeDialog = new ADOBE.SubscribeDialog();

			$("body").on("subscriptionPurchased", function() {
				adobeDPS.dialogService.dismissWelcomeScreen();
			});
			
			$("body").append(subscribeDialog.render().el);
		}
	}

	function subscribeButtonSheet_changeHandler(buttonIndex) {
		if (buttonIndex < subscriptions.length) { // disregard the last button since it is the cancel button.
			var transaction = subscriptions[buttonIndex].purchase();
			transaction.completedSignal.addOnce(function(transaction) {
				if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED)
					adobeDPS.dialogService.dismissWelcomeScreen();
				else if (transaction.state == adobeDPS.transactionManager.transactionStates.FAILED)
					alert("Unable to purchase subscription.");
			});
		}
	}

	function printSubscriberButtonClickHandler() {
		if (isIPhone()) { // On the iphone a slideup login form is displayed.
			var loginForm = new ADOBE.LoginForm();
			$("body").append(loginForm.render().el);
			loginForm.$el.on("loginSuccess", function(){
				adobeDPS.dialogService.dismissWelcomeScreen();
			});
		} else { // On the ipad a login dialog is displayed.
			var loginDialog = new ADOBE.LoginDialog();
			$("body").append(loginDialog.render().el);
			
			// Triggered from the dialog when a login is successful.
			loginDialog.$el.on("loginSuccess", function() {
				adobeDPS.dialogService.dismissWelcomeScreen();
			});
		}
	}

	// Handler for current itunes users.
	function itunesButtonClickHandler() {
		// Show the spinner while the user restores purchases.
		$("#spinner-container").show();

		var transaction = adobeDPS.receiptService.restorePurchases();
		transaction.completedSignal.addOnce(function() {
			$("#spinner-container").hide();
			if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED)
				adobeDPS.dialogService.dismissWelcomeScreen(); // If restore purchases was successful then remove the welcome screen.
		})
	}

	// Handler for when a user clicks the go to store button.
	function storeButtonClickHandler() {
		adobeDPS.dialogService.dismissWelcomeScreen();
	}

	// Adds the callbacks for a download.
	function addDownloadCallBacks(transaction, folio) {
		// Hide the indeterminate spinner.
		$("#spinner-container").hide();

		// Add a callback to display the progress.
		transaction.progressSignal.add(function(transaction) {
			$progressBar.width(transaction.progress * .01 * window.innerWidth);
		});

		// Add a callback for when the download has finished.
		transaction.completedSignal.add(function() {
			// Set the width to zero rather than removing it so the messaging doesn't recenter vertically.
			$progressBar.width(0);

			var html  = "Enjoy your free preview of " + folio.title + ".";
				html += "<div id='view-issue-button'>View Issue <div class='arrow-right-large'></div></div>";
			$("#messaging").html(html);

			$("#view-issue-button").on("click", function() {
				viewFolio(folio);
			});
		})

		// Add a callback to listen for state changes to the folio.
		// For this case we only want to see when isViewable changes.
		folio.updatedSignal.add(function(properties) {
			if (properties.indexOf("isViewable") > -1 && folio.isViewable && ADOBE.Config.isAutoOpenDownloadedFolio)
				viewFolio(folio);
		});
	}

	function viewFolio(folio) {
		folio.view();
		adobeDPS.dialogService.dismissWelcomeScreen();
	}

	// Looks for the first preview folio.
	function findFirstPromotionalFolio() {
		if (previewFolios.length > 0) {
			var folio = previewFolios.shift();
			if (folio.isPurchasable && !folio.hasSections) {
				var transaction = folio.verifyContentPreviewSupported(); // Check to see if this folio supports previews.
				transaction.completedSignal.addOnce(verifyContentPreviewSupportedHandler, this);
			} else {
				findFirstPromotionalFolio();
			}
		} else { // Searched through all of the folios and none have preview enabled.
			findFirstFreeFolio();
		}
	}

	// Handler to verifyContentPreviewSupported.
	function verifyContentPreviewSupportedHandler(transaction) {
		if (transaction.folio.supportsContentPreview) {
			var folio = transaction.folio;
			var transaction = folio.downloadContentPreview();
			addDownloadCallBacks(transaction, folio);
		} else {
			findFirstPromotionalFolio();
		}
	}

	// A fallback to display a preview. Loops through the folios and finds the first free one.
	function findFirstFreeFolio() {
		var len = folios.length;
		var folioStates = adobeDPS.libraryService.folioStates;
		for (var i = 0; i < len; i++) {
			if (folios[i].state >= folioStates.ENTITLED) {
				var folio = folios[i];
				var transaction = folio.download();
				addDownloadCallBacks(transaction, folio);
				break;
			}
		}

		$("#spinner-container").hide();
	}
});