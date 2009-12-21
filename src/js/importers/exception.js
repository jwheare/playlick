function Exception (message, diagnostics) {
    this.message = message;
    this.diagnostics = diagnostics;
};
Exception.prototype = {
    name: 'Exception',
    toString: function () {
        return this.name + ': ' + this.message;
    },
    /**
     * Exception#diagnose()
     * Log diagnostics to the console
    **/
    diagnose: function () {
        if (!PLAYLICK.debug) {
            return false;
        }
        console.warn(this.toString());
        if (!this.diagnostics) {
            return;
        }
        if (typeof this.diagnostics == 'string') {
            console.log(this.diagnostics);
        } else {
            console.dir(this.diagnostics);
        }
    }
};
/**
 * partialException allows a constructor to return a finalise function instead of the Exception.
 * This function takes a message and optional diagnostic object as arguments, and when called
 * returns the Exception object.
 * This allows you to setup a partial exception that can later be thrown with different error messages.
 * If you pass a message into the constructor, it returns the object straightaway.
 * 
 * e.g.
 * // Prepare exception
 * var exception = new Exception();
 * ...
 * // Throw exception, adding extra info
 * throw exception('Call exception', call);
**/
function partialException (exception) {
    if (!exception.message) {
        return function finalise (message, diagnostics) {
            exception.message = message;
            exception.diagnostics = diagnostics;
            return exception;
        };
    }
    return exception;
}
