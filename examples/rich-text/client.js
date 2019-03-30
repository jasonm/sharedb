var sharedb = require('@teamwork/sharedb/lib/client');
var richText = require('rich-text');
var Quill = require('quill');
var QuillCursors = require('quill-cursors');

Quill.register('modules/cursors', QuillCursors);

sharedb.types.register(richText.type);

// Open WebSocket connection to ShareDB server
var socket = new WebSocket('ws://' + window.location.host);
var connection = new sharedb.Connection(socket);

// For testing reconnection
window.disconnect = function() {
  connection.close();
};
window.connect = function() {
  var socket = new WebSocket('ws://' + window.location.host);
  connection.bindToSocket(socket);
};

// Helper functions for nicely displaying uid
function uidColor(uid) {
  var colors = [
    'red', 'blue', 'green', 'purple', 'orange',
    'olive', 'maroon', 'yellow', 'lime', 'teal',
  ];
  var n = parseInt(uid, 10);
  var idx = n % 10;
  return colors[idx];
}

function uidName(uid) {
   return "User " + uid;
}

function renderNameplate(uid) {
  var css = "background-color: " + uidColor(uid) + ";";
  document.getElementById('nameplate').style = css;
  document.getElementById('nameplate').innerText = uidName(uid);
}

// Create local Doc instance mapped to 'examples' collection document with id 'richtext'
var doc = connection.get('examples', 'richtext');


// Generate a random uid and display it.
var uid = String(Math.floor(Math.random() * 100000));
renderNameplate(uid);

doc.subscribe(function(err) {
  if (err) throw err;
  var quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      cursors: true,
    }
  });

  var cursors = quill.getModule('cursors');
  cursors.createCursor(uid, uidName(uid), uidColor(uid));

  quill.setContents(doc.data);
  quill.on('text-change', function(delta, oldDelta, source) {
    if (source !== 'user') return;
    doc.submitOp(delta, {source: quill});
  });

  doc.on('op', function(op, source) {
    if (source === quill) return;
    quill.updateContents(op);
  });

  // When we receive information about updated presences,
  // update the locall QuillCursor(s).
  doc.on('presence', function(srcList, submitted) {
    srcList.forEach(function(src) {
      if (doc.presence[src]) {
        var uid = doc.presence[src].u;
        // TODO: Can QuillCursors support multiple selections?
        var sel = doc.presence[src].s[0];

        // Use Math.abs because the sharedb presence type
        // supports reverse selections, but I don't think
        // Quill Cursors does.
        var len = Math.abs(sel[1] - sel[0]);

        // Re-creating an existing cursor is a no-op
        cursors.createCursor(uid, uidName(uid), uidColor(uid));
        cursors.moveCursor(uid, { index: sel[0], length: len });
      }
    });
  })

  // When the local Quill selection changes, publish our new
  // local presence data.
  quill.on('selection-change', function(range, oldRange, source) {
    if (range) {
      doc.submitPresence({
        u: uid,
        c: 0,
        s: [
            [ range.index, range.index + range.length ],
        ]
      });
    } else {
      // Cursor not in the editor
    }
  });
});
