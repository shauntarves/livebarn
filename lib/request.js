/**
 * Internal dependencies
 */
const { api } = require("./api");

class Request {
  constructor(url, params = {}, token = null) {
    this.url = url;
    this.params = params;
    this.token = token;
  }

  do(method, responseType = null) {
    const headers = {};
    if (this.token) {
      headers.Authorization = this.token;
    }
    const request = {
      method: method,
      url: this.url,
      params: this.params,
      headers: headers,
    };
    if (responseType) {
      request.responseType = responseType;
    }
    return api(request);
  }
}

exports.Request = Request;
