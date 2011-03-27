// Pluralizes a string by adding an 's' on the end
String.prototype.pluralize = function(count) {
  if (count == undefined) count = 0;
  return count + " " + ((count == 1 || count == '1')? this : this + 's');
};
/* To Title Case 1.1.1
 * David Gouch <http://individed.com>
 * 23 May 2008
 * License: http://individed.com/code/to-title-case/license.txt
 *
 * In response to John Gruber's call for a Javascript version of his script: 
 * http://daringfireball.net/2008/05/title_case
 */
String.prototype.toTitleCase = function() {
  return this.replace(/([\w&`'‘’"“.@:\/\{\(\[<>_]+-? *)/g, function(match, p1, index, title) {
    if (index > 0 && title.charAt(index - 2) !== ":" && match.search(/^(a(nd?|s|t)?|b(ut|y)|en|for|i[fn]|o[fnr]|t(he|o)|vs?\.?|via)[ \-]/i) > -1)
      return match.toLowerCase();
    if (title.substring(index - 1, index + 1).search(/['"_{(\[]/) > -1)
      return match.charAt(0) + match.charAt(1).toUpperCase() + match.substr(2);
    if (match.substr(1).search(/[A-Z]+|&|[\w]+[._][\w]+/) > -1 || title.substring(index - 1, index + 1).search(/[\])}]/) > -1)
      return match;
    return match.charAt(0).toUpperCase() + match.substr(1);
  });
};
String.prototype.escape = function() {
  return escape(this.replace(/\s/g, '-'));
}
String.prototype.unescape = function() {
  return unescape(this).replace(/[-_]/g, ' ');
}
Date.prototype.duration = function(other, unit) {
  var duration = other - this;
  if (unit == 'seconds') {
    duration = Math.round(duration/1000); 
  } else if (unit == 'minutes') {
    duration = Math.round(duration/(60000));
  } else if (unit == 'words') {
    duration = Math.round(duration/1000);
    if (duration <= 0) {
      duration = "now";
    } else if (duration >= 1 && duration <= 3599) {
      duration = "min".pluralize(Math.ceil(duration/60));
    } else if (duration >= 3600 && duration <= 86399) {
      var durationInHours = Math.floor(duration/3600);
      var remainderInMinutes = (duration % 3600)/60;
      if (remainderInMinutes < 30) {
        duration = "hour".pluralize(durationInHours);
      } else {
        duration = "hour".pluralize(durationInHours + 0.5);
      }
    } else if (duration >= 86400 && duration <= 2591999) {
      var durationInDays = Math.floor(duration/86400);
      var remainderInHours = (duration % 86400)/3600;
      if (remainderInHours < 12) {
        duration = "day".pluralize(durationInDays);
      } else {
        duration = "day".pluralize(durationInDays + 0.5);
      }
    } else if (duration <= 2592000 && duration <= 31535999) {
      duration = "mth".pluralize(Math.ceil(duration/2592000));
    } else {
      duration = "yr".pluralize(Math.ceil(duration/31536000));
    }
  }
  return duration;
};
// Returns a Date for the next second, minute or hour
Date.prototype.next = function(unit) {
  var n = new Date(this.getTime());
  if (unit == 'millisecond' || unit == undefined) {
    n.setMilliseconds(this.getMilliseconds() + 1);
  } else if (unit == 'second') {
    n.setSeconds(this.getSeconds() + 1);
    n.setMilliseconds(0);
  } else if (unit == 'minute') {
    n.setMinutes(this.getMinutes() + 1);
    n.setSeconds(0);
    n.setMilliseconds(0);
  } else if (unit == 'hour') {
    n.setHours(this.getHours() + 1);
    n.setMinutes(0);
    n.setSeconds(0);
    n.setMilliseconds(0);
  }
  return n;
}
Date.__original_parse__ = Date.parse;
Date.parse = function(other) {
  if (_.isNumber(other)) {
    var date = new Date();
    date.setTime(other);
    return date;
  } else if (_.isDate(other)) {
    return other;
  } else {
    return Date.__original_parse__(other);
  }
}
Date.now = function() { return new Date(); }