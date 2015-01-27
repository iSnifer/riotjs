
var BOOL_ATTR = ('allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,default,'+
  'defaultchecked,defaultmuted,defaultselected,defer,disabled,draggable,enabled,formnovalidate,hidden,'+
  'indeterminate,inert,ismap,itemscope,loop,multiple,muted,nohref,noresize,noshade,novalidate,nowrap,open,'+
  'pauseonexit,readonly,required,reversed,scoped,seamless,selected,sortable,spellcheck,translate,truespeed,'+
  'typemustmatch,visible').split(',')


// (tagname) (html) (javascript) endtag
var CUSTOM_TAG = /^<([\w\-]+)>([^\x00]*[\w\/]>$)([^\x00]*?)^<\/\1>/gim,
    SCRIPT = /<script(\s+type=['"]?([^>'"]+)['"]?)?>([^\x00]*?)<\/script>/gm,
    HTML_COMMENT = /<!--.*?-->/g,
    CLOSED_TAG = /<([\w\-]+)([^\/]*)\/\s*>/g,
    LINE_COMMENT = /^\s*\/\/.*$/gm,
    JS_COMMENT = /\/\*[^\x00]*?\*\//gm


function compileHTML(html, opts, type) {

  // whitespace
  html = html.replace(/\s+/g, ' ')

  // strip comments
  html = html.trim().replace(HTML_COMMENT, '')

  // foo={ bar } --> foo="{ bar }"
  html = html.replace(/=(\{[^\}]+\})([\s\>])/g, '="$1"$2')

  // IE8 looses boolean attr values: `checked={ expr }` --> `__checked={ expr }`
  html = html.replace(/([\w\-]+)=["'](\{[^\}]+\})["']/g, function(full, name, expr) {
    if (BOOL_ATTR.indexOf(name.toLowerCase()) >= 0) name = '__' + name
    return name + '="' + expr + '"'
  })

  // run trough parser
  if (opts.expr) {
    html = html.replace(/\{\s*([^\}]+)\s*\}/g, function(_, expr) {
       return '{' + compileJS(expr, opts, type).trim() + '}'
    })
  }

  // <foo/> -> <foo></foo>
  html = html.replace(CLOSED_TAG, function(_, tagName, attr) {
    return '<' + tagName + (attr ? ' ' + attr.trim() : '') + '></' + tagName + '>'
  })

  // escape single quotes
  html = html.replace(/'/g, "\\'")


  // \{ jotain \} --> \\{ jotain \\}
  html = html.replace(/\\[{}]/g, '\\$&')

  // compact: no whitespace between tags
  if (opts.compact) html = html.replace(/> </g, '><')

  return html

}

function coffee(js) {
  return require('coffee-script').compile(js, { bare: true })
}

function es6(js) {
  return require('6to5').transform(js).code
}

function plainjs(js) {
  return js
}

function riotjs(js) {

  // strip comments
  js = js.replace(LINE_COMMENT, '').replace(JS_COMMENT, '')

  // ES6 method signatures
  var lines = js.split('\n'),
      es6_ident = ''

  lines.forEach(function(line, i) {
    var l = line.trim()

    // method start
    if (l[0] != '}' && l.indexOf('(') > 0 && l.slice(-1) == '{' && l.indexOf('function') == -1) {
      var m = /(\s+)([\w]+)\s*\(([\w,\s]*)\)\s*\{/.exec(line)

      if (m && !/^(if|while|switch|for)$/.test(m[2])) {
        lines[i] = m[1] + 'this.' + m[2] + ' = function(' + m[3] + ') {'
        es6_ident = m[1]
      }

    }

    // method end
    if (line.slice(0, es6_ident.length + 1) == es6_ident + '}') {
      lines[i] += '.bind(this);'
      es6_ident = ''
    }

  })

  return lines.join('\n')

}

var PARSERS = {
  coffeescript: coffee,
  none: plainjs,
  cs: coffee,
  es6: es6
}


function compileJS(js, opts, type) {
  var parser = opts.parser || (type ? PARSERS[type] : riotjs)
  if (!parser) throw new Error('Parser not found "' + type + '"')
  return parser(js, opts)
}

function compile(riot_tag, opts) {

  opts = opts || {}

  return riot_tag.replace(CUSTOM_TAG, function(_, tagName, html, js) {

    // js wrapped inside <script> tag
    var type = opts.type

    if (!js.trim()) {
      html = html.replace(SCRIPT, function(_, fullType, _type, script) {
        if (_type) type = _type.replace('text/', '')
        js = script
        return ''
      })
    }

    return 'riot.tag(\'' +tagName+ '\', \'' + compileHTML(html, opts, type) + '\', function(opts) {' +
      compileJS(js, opts, type) +
    '\n});'

  })

}

module.exports = {
  html: compileHTML,
  compile: compile
}

