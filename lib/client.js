/**
 * Internal dependencies
 */
const { Request } = require("./request");

/**
 * Constants
 */
// BasicToken is the api auth token needed to request a new user access token
const BasicToken = "TGl2ZUJhcm4gUWE6MDcyMDE0";

// The web server location for making livebarn API requests
const ApiUrl = "https://webapi.livebarn.com/api/v2.0.0/";

class Client {
  constructor(username, password, uuid) {
    if (!username || !password || !uuid) {
      throw new Error("credentials error - please provide missing credentials");
    }
    this._basicToken = BasicToken;
    this._apiUrl = ApiUrl;
    this._accessToken;
    this._username = username;
    this._password = password;
    this._uuid = uuid;
  }

  async login() {
    return await new Request(
      "https://webapi.livebarn.com/oauth/token",
      {
        username: this._username,
        password: this._password,
        grant_type: "password",
      },
      `Basic ${this._basicToken}`
    )
      .do("post")
      .catch((error) => {
        console.log(error);
        throw new Error("authentication error - please check credentials");
      })
      .then(
        (credentials) => (this._accessToken = credentials.data.access_token)
      );
  }

  getMediaList(getMediaListRequest) {
    let url = `${this._apiUrl}media/surfaceid/${getMediaListRequest.surface.id}/feedmodeid/${getMediaListRequest.feedMode}`;
    if (getMediaListRequest.dateRange.start) {
      url += `/begindate/${getMediaListRequest.dateRange.start.toJSON()}`;
    }
    if (getMediaListRequest.dateRange.end) {
      url += `/enddate/${getMediaListRequest.dateRange.end.toJSON()}`;
    }
    console.log(url);
    return new Request(url, {}, `Bearer ${this._accessToken}`)
      .do("get")
      .then((response) => response.data);
  }

  getAmList(url) {
    return new Request(url).do("get");
  }

  getPlaylistList(url) {
    return new Request(url).do("get");
  }

  getChunk(getChunkRequest) {
    return new Request(getChunkRequest.url).do(
      "get",
      getChunkRequest.responseType
    );
  }

  getChunkList(url) {
    return new Request(url).do("get");
  }
}

exports.Client = Client;
