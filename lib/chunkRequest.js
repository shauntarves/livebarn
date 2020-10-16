class ChunkRequest {
  constructor(url, responseType = "stream") {
    this.url = url;
    this.responseType = responseType;
  }
}

exports.ChunkRequest = ChunkRequest;
