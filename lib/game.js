/**
 * Internal dependencies
 */
const { DateRange } = require("./dateRange");

class Game {
  constructor(surface, startDateTime, duration, feedMode) {
    this.surface = surface;
    this.dateRange = new DateRange(
      startDateTime,
      new Date(startDateTime.getTime() + duration * 60 * 1000)
    );
    this.feedMode = feedMode;
  }

  createFilenameForGame() {
    let parts = [];
    parts.push(`${this.surface.id}`);
    parts.push(`${this.dateRange.start.toJSON()}`);
    if (this.dateRange.end) {
      parts.push(`${this.dateRange.end.toJSON()}`);
    }
    parts.push(`${this.feedMode}`);
    return parts.join("-");
  }
}

exports.Game = Game;
