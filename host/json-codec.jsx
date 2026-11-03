var ZMotionJson = (function () {
    function quote(value) {
        return '"' + value.replace(/["\\\x00-\x1f\u2028\u2029]/g, function (character) {
            var hex = character.charCodeAt(0).toString(16);
            return '\\u' + ('0000' + hex).slice(-4);
        }) + '"';
    }

    function stringify(value) {
        var parts = [];
        var key;
        var index;
        if (value === null || typeof value === 'undefined') return 'null';
        if (typeof value === 'string') return quote(value);
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return isFinite(value) ? String(value) : 'null';
        if (Object.prototype.toString.call(value) === '[object Array]') {
            for (index = 0; index < value.length; index++) parts.push(stringify(value[index]));
            return '[' + parts.join(',') + ']';
        }
        for (key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) parts.push(quote(key) + ':' + stringify(value[key]));
        }
        return '{' + parts.join(',') + '}';
    }

    function parse(text) {
        var cursor = 0;
        if (typeof text !== 'string' || text.length > 524288) throw new Error('Invalid request size.');

        function fail() { throw new Error('Invalid JSON request.'); }
        function whitespace() { while (cursor < text.length && /[\x20\t\r\n]/.test(text.charAt(cursor))) cursor++; }
        function string() {
            var value = '';
            var character;
            var escape;
            var hex;
            var escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
            cursor++;
            while (cursor < text.length) {
                character = text.charAt(cursor++);
                if (character === '"') return value;
                if (character === '\\') {
                    escape = text.charAt(cursor++);
                    if (escape === 'u') {
                        hex = text.substr(cursor, 4);
                        if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
                        value += String.fromCharCode(parseInt(hex, 16));
                        cursor += 4;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(escapes, escape)) fail();
                        value += escapes[escape];
                    }
                } else {
                    if (character.charCodeAt(0) < 32) fail();
                    value += character;
                }
            }
            fail();
        }

        function read(depth) {
            var character;
            var collection;
            var key;
            var number;
            var literal;
            if (depth > 32) fail();
            whitespace();
            character = text.charAt(cursor);
            if (character === '"') return string();
            if (character === '{' || character === '[') {
                var object = character === '{';
                var end = object ? '}' : ']';
                collection = object ? {} : [];
                cursor++;
                whitespace();
                if (text.charAt(cursor) === end) { cursor++; return collection; }
                while (cursor < text.length) {
                    whitespace();
                    if (object) {
                        if (text.charAt(cursor) !== '"') fail();
                        key = string();
                        if (key === '__proto__' || key === 'constructor' || key === 'prototype') fail();
                        whitespace();
                        if (text.charAt(cursor++) !== ':') fail();
                        collection[key] = read(depth + 1);
                    } else collection.push(read(depth + 1));
                    whitespace();
                    character = text.charAt(cursor++);
                    if (character === end) return collection;
                    if (character !== ',') fail();
                }
                fail();
            }
            literal = text.substr(cursor, 4);
            if (literal === 'null') { cursor += 4; return null; }
            if (literal === 'true') { cursor += 4; return true; }
            if (text.substr(cursor, 5) === 'false') { cursor += 5; return false; }
            number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(cursor));
            if (!number || !isFinite(Number(number[0]))) fail();
            cursor += number[0].length;
            return Number(number[0]);
        }

        var result = read(0);
        whitespace();
        if (cursor !== text.length) fail();
        return result;
    }

    return { parse: parse, stringify: stringify };
}());
