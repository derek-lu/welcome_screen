(function($) {
$.fn.buttonSheet = function(method) {
	if ( this[0][method] ) {
		return this[0][ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
	} else if ( typeof method === 'object' || ! method ) {
		return this.each(function() {
			var selectedIndex;
			var $this = $(this);
			var $el;
			var $modalBackground;
			
			var buttons = "";
			for (var i = 0; i < method.buttons.length; i++) {
				buttons += "<div class='button-sheet-button text-link'>" + method.buttons[i] + "</div>";
			}
			
			buttons += "<div class='button-sheet-button button-sheet-cancel-button text-link'>Cancel</div>";

			var html  = "<div class='button-sheet'>";
				html +=     "<div class='title'>" + method.title + "</div>";
				html += buttons;
				html += "</div>";
			
			$el = $(html);
			$el.appendTo($this);
			
			$el.css("top", window.innerHeight);
			$el.css("-webkit-transform", "translateY(" + -$el.height() + "px)");
			
			$modalBackground = $("<div class='modal-background'></div>");
			$modalBackground.appendTo($this);
			// Need to set a timeout so it will fade in.
			setTimeout(function(){$modalBackground.css("opacity", 1)}, 10);
			
			var scope = this;
			$el.on("click", ".button-sheet-button", function(e) {
				$this.trigger("change", $(e.target).index() - 1); // Take into account the title.
				scope.close();
			});
			
			/*
			 * Public methods.
			 */
			this.getSelectedIndex = function() {
				return selectedIndex;
			}
			
			this.close = function() {
				$el.css("-webkit-transform", "translateY(0px)");
				$modalBackground.css("opacity", 0);
				$el.one("webkitTransitionEnd", function(){ 
					$el.remove();
					$modalBackground.remove();
				});
			}
		});
	} else {
		$.error( 'Method ' +  method + ' does not exist on jQuery.tooltip' );
	} 
}
})(jQuery);
