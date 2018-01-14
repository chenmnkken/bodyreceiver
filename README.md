# koa-bodyreceiver

A request body receiver & parser middleware for Koa@2+.

Support body type:

* `application/json`
* `application/x-www-form-urlencoded`
* `text/plain`
* `multipart/form-data`

### Install

```
// npm
npm install bodyreceiver
// yarn
yarn add bodyreceiver
```

### Usage

```javascript
var Koa = require('koa');
var BodyReceiver = require('bodyreceiver');

var app = new Koa();
var bodyReceiver = new BodyReceiver();

app.use(bodyReceiver.startup());

app.use((ctx, next) => {
	// Received body pass to ctx.request.body
	ctx.body = ctx.request.body;
	return next();
});

app.listen(3000, '127.0.0.1');
```

### API

* **BodyReceiver([options])**

BodyReceiver main Class, will return new instance.

```javascript
var bodyReceiver = new BodyReceiver();
```

* **bodyReceiver.startup()**

Register `bodyReceiver` middleware for Koa.


### Upload file

```html
<!-- Example form html -->
<form action="/file" method="POST" enctype="multipart/form-data">
    <input type="text" name="firstname" />
    <input type="text" name="lastname" />
    <input type="file" name="image" />
    <button>Submit</button>
</form>
```

```javascript
// upload file result
console.log(ctx.request.body);

{
    fields: { // other filed
        firstname: 'foo',
        lastname: 'bar',
    },
    files: {
        image: [{
            name: 'b84f4a4a275002d3379c3be782369cff.jpg', // filename
            type: 'image/jpeg', // filetype
            size: 976, // filesize
            contents: <Buffer ...>,  // file contents is Buffer type
            createReadStream: [Function]  // readable Stream
        }]
    }
}
```

If use `FileReader` read base64 file in browser, then upload the base64 file, set the `content-type` header to `text/plain`.

### Options

* **accept** `Regexp / Function`, *Upload file only*, default is `null`, means accept all file type.

limit accept file type, if `accept` is Regexp, will test file MIME type, if `accept` is Function, will invoke function test file type and size.

```javascript
{
    accept: function (type, size) {
        // must return Boolean result
    }
}
```

* **write** `Boolean`, *Upload file only*, default is `false`.

Whether write file to disk, uploaded file contents default is Buffer type, can pass through the Stream transmission.

* **maxBodySize** `String`, default is `1mb`.

Maximum body size, the value can pass through [bytes](https://github.com/visionmedia/bytes.js) parse, if body size greater than `maxBodySize` will emit error event.

* **maxFileSize** `String`, *Upload file only*, default is `3mb`.

Maximum uploaded file size, the value can pass through [bytes](https://github.com/visionmedia/bytes.js) parse, if file size greater than `maxFileSize` will emit error event.

* **minFileSize** `String`, *Upload file only*, default is `null`.

Minimum uploaded file size, the value can pass through [bytes](https://github.com/visionmedia/bytes.js) parse, if file size less than `minFileSize` will emit error event.

* **keepFilename** `Boolean`, *Upload file only*, default is `false`.

Whether keep origin file name. If value is `false`, the BodyReceiver will generate a new hash name by file contents, is value is `true`, keep origin file name.

* **generateFilename** `Boolean`, *Upload file only*, default is `null`.

Custom generate file name rules.

```javascript
{
    generateFilename: function (originName, hashName, extName) {
        // must return a new filename
    }
}
```

* **dest** `String`, *Upload file only*, default is `process.cwd() + '/upload'`.

Uploaded file save folder, the `dest` must coordination `write` usage, if `dest`  folder is not exists, the BodyReceiver will create a new folder, the new folder permission is `0777`.

### Events

The BodyReceiver can emit various events.

* **error** Error event, body parse error, file type or size is invalid, both emit error event.

```javascript
bodyReceiver.on('error', function (error, ctx) {
    console.error(error);
    ctx.throw(error, 422);
});
```

* **progress** Receive file progress event.

* **aborted** Receive file aborted event.

* **data** If the file is valid, will emit `data` event.

* **file** If the file is write to disk, will emit `file` event.

* **end** If the file receive is end, will emit `end` event.


### License

MIT @ [Yiguo Chen](https://github.com/chenmnkken)
