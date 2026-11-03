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

var ZMotion = (function () {
    var ticksPerSecond = 254016000000;
    var allowedMotions = { fade: true, 'slide-left': true, 'slide-right': true, 'slide-up': true, 'slide-down': true, zoom: true, spin: true };

    function fail(message) { throw new Error(message); }
    function number(value, min, max, name) {
        if (typeof value !== 'number' || !isFinite(value) || value < min || value > max) fail('Invalid ' + name + '.');
        return value;
    }
    function isArray(value) { return Object.prototype.toString.call(value) === '[object Array]'; }
    function time(seconds) {
        var result = new Time();
        result.seconds = Math.round(seconds * 100000000) / 100000000;
        return result;
    }
    function successful(status, action) {
        if (status !== 0 && status !== true) fail('Premiere rejected ' + action + '.');
    }

    function context() {
        var sequence = app.project && app.project.activeSequence;
        var clips = [];
        var ignoredAudio = 0;
        var selected;
        var index;
        if (!sequence) return { sequence: null, clips: clips, ignoredAudio: 0, secondsPerFrame: 0, token: '' };
        selected = sequence.getSelection();
        for (index = 0; index < selected.length; index++) {
            if (selected[index].mediaType === 'Video') clips.push(selected[index]);
            else ignoredAudio++;
        }
        clips.sort(function (first, second) {
            if (first.start.seconds !== second.start.seconds) return first.start.seconds - second.start.seconds;
            return String(first.nodeId) < String(second.nodeId) ? -1 : 1;
        });
        var frame = Number(sequence.timebase) / ticksPerSecond;
        number(frame, 1 / 240, 1, 'sequence frame rate');
        var identifiers = [String(sequence.sequenceID), String(sequence.timebase)];
        for (index = 0; index < clips.length; index++) {
            identifiers.push([String(clips[index].nodeId), clips[index].start.seconds, clips[index].end.seconds, clips[index].inPoint.seconds]);
        }
        return { sequence: sequence, clips: clips, ignoredAudio: ignoredAudio, secondsPerFrame: frame, token: ZMotionJson.stringify(identifiers) };
    }

    function inspect() {
        var state = context();
        var clips = [];
        var index;
        for (index = 0; index < state.clips.length; index++) {
            clips.push({ id: String(state.clips[index].nodeId), name: state.clips[index].name, durationFrames: Math.round((state.clips[index].end.seconds - state.clips[index].start.seconds) / state.secondsPerFrame) });
        }
        return {
            hostVersion: String(app.version), sequenceId: state.sequence ? String(state.sequence.sequenceID) : '',
            sequenceName: state.sequence ? state.sequence.name : 'No active sequence',
            frameRate: state.sequence ? 1 / state.secondsPerFrame : 0,
            width: state.sequence ? state.sequence.frameSizeHorizontal : 0,
            height: state.sequence ? state.sequence.frameSizeVertical : 0,
            clips: clips, ignoredAudio: state.ignoredAudio, selectionToken: state.token
        };
    }

    function mutationContext(payload) {
        var state = context();
        if (!state.sequence) fail('Open a sequence in Premiere first.');
        if (!state.clips.length) fail('Select at least one video clip in the timeline.');
        if (state.clips.length > 50) fail('Select no more than 50 video clips per operation.');
        if (payload.selectionToken !== state.token) fail('The timeline selection changed. Refresh and try again.');
        return state;
    }

    function getParameter(clip, property) {
        var opacity = property === 'opacity';
        var names = opacity ? ['AE.ADBE Opacity', 'ADBE Opacity'] : ['AE.ADBE Motion', 'ADBE Motion'];
        var indexes = { position: 0, scale: 1, rotation: 4, opacity: 0 };
        var components = clip.components;
        var component;
        var index;
        for (index = 0; index < components.numItems; index++) {
            if (components[index].matchName === names[0] || components[index].matchName === names[1]) component = components[index];
        }
        if (!component || indexes[property] === undefined || component.properties.numItems <= indexes[property]) fail('Unsupported ' + property + ' parameter on "' + clip.name + '". Use a standard video clip with native Motion and Opacity.');
        if (property === 'scale' && component.properties.numItems > 3 && !component.properties[3].getValue()) fail('Enable Uniform Scale on "' + clip.name + '" before changing scale.');
        return component.properties[indexes[property]];
    }

    function validateValue(value, property) {
        if (property === 'position') {
            if (!isArray(value) || value.length !== 2) fail('Unsupported position value.');
            number(value[0], -100000, 100000, 'horizontal position');
            number(value[1], -100000, 100000, 'vertical position');
        } else number(value, -100000, 100000, property);
    }

    function validatePlan(payload) {
        var recipe = payload.recipe;
        var samples = payload.samples;
        var index;
        if (!recipe || !Object.prototype.hasOwnProperty.call(allowedMotions, recipe.motion)) fail('Unknown animation.');
        if (recipe.direction !== 'in' && recipe.direction !== 'out') fail('Invalid animation direction.');
        number(recipe.durationFrames, 2, 300, 'duration');
        number(recipe.staggerFrames, 0, 120, 'stagger');
        if (Math.floor(recipe.durationFrames) !== recipe.durationFrames || Math.floor(recipe.staggerFrames) !== recipe.staggerFrames) fail('Use whole frames.');
        number(recipe.amount, 0, recipe.motion === 'spin' ? 1080 : 100, 'amount');
        if (typeof recipe.replaceExisting !== 'boolean') fail('Invalid replacement policy.');
        if (!isArray(samples) || samples.length !== recipe.durationFrames || samples[0] !== 0 || samples[samples.length - 1] !== 1) fail('Invalid keyframe samples.');
        for (index = 0; index < samples.length; index++) number(samples[index], -2, 3, 'curve sample');
        return recipe;
    }

    function propertyFor(motion) {
        if (motion === 'fade') return 'opacity';
        if (motion === 'zoom') return 'scale';
        if (motion === 'spin') return 'rotation';
        return 'position';
    }

    function animatedValue(base, progress, recipe) {
        var offset = recipe.direction === 'in' ? 1 - progress : progress;
        if (recipe.motion === 'fade') return Math.max(0, Math.min(100, base * (1 - offset)));
        if (recipe.motion === 'zoom') return Math.max(0.1, base * (1 - offset * recipe.amount / 100));
        if (recipe.motion === 'spin') return base - offset * recipe.amount;
        var result = [base[0], base[1]];
        var axis = recipe.motion === 'slide-left' || recipe.motion === 'slide-right' ? 0 : 1;
        var sign = recipe.motion === 'slide-left' || recipe.motion === 'slide-down' ? -1 : 1;
        result[axis] += sign * offset * recipe.amount / 100;
        return result;
    }

    function prepareAnimation(clip, recipe, samples, frame, order) {
        if (typeof clip.getSpeed !== 'function' || Math.abs(clip.getSpeed() - 1) > 0.000001 || (typeof clip.isSpeedReversed === 'function' && clip.isSpeedReversed())) fail('Use forward clips at 100% speed. Retimed clips are not supported yet.');
        var frameCount = Math.floor((clip.end.seconds - clip.start.seconds) / frame + 0.00001);
        var offset = order * recipe.staggerFrames;
        var first = recipe.direction === 'in' ? offset : frameCount - recipe.durationFrames - offset;
        if (first < 0 || first + recipe.durationFrames > frameCount) fail('"' + clip.name + '" is too short for this duration and stagger.');
        var property = propertyFor(recipe.motion);
        var parameter = getParameter(clip, property);
        if (!parameter.areKeyframesSupported()) fail('Keyframes are not supported on "' + clip.name + '".');
        var start = time(clip.inPoint.seconds + first * frame);
        var end = time(clip.inPoint.seconds + (first + recipe.durationFrames - 1) * frame);
        var baseTime = recipe.direction === 'in' ? end : start;
        var base = parameter.isTimeVarying() ? parameter.getValueAtTime(baseTime) : parameter.getValue();
        validateValue(base, property);
        var keys = parameter.isTimeVarying() ? parameter.getKeys() : [];
        var index;
        var collisions = false;
        if (keys) {
            for (index = 0; index < keys.length; index++) {
                if (keys[index].seconds >= start.seconds - 0.000001 && keys[index].seconds <= end.seconds + 0.000001) collisions = true;
            }
        }
        if (collisions && !recipe.replaceExisting) fail('"' + clip.name + '" has existing keyframes in this range. Enable replacement or choose another range.');
        var values = [];
        for (index = 0; index < samples.length; index++) values.push({ time: time(clip.inPoint.seconds + (first + index) * frame), value: animatedValue(base, samples[index], recipe) });
        return { parameter: parameter, start: start, end: end, collisions: collisions, values: values };
    }

    function animate(payload) {
        var recipe = validatePlan(payload);
        var state = mutationContext(payload);
        var plans = [];
        var index;
        var key;
        var writes = 0;
        var complete = 0;
        for (index = 0; index < state.clips.length; index++) plans.push(prepareAnimation(state.clips[index], recipe, payload.samples, state.secondsPerFrame, index));
        try {
            for (index = 0; index < plans.length; index++) {
                var plan = plans[index];
                successful(plan.parameter.setTimeVarying(true), 'animation mode');
                if (plan.collisions) successful(plan.parameter.removeKeyRange(plan.start, plan.end, true), 'keyframe replacement');
                for (key = 0; key < plan.values.length; key++) {
                    successful(plan.parameter.addKey(plan.values[key].time), 'keyframe creation');
                    successful(plan.parameter.setValueAtKey(plan.values[key].time, plan.values[key].value, key === plan.values.length - 1), 'keyframe value');
                    successful(plan.parameter.setInterpolationTypeAtKey(plan.values[key].time, 0, key === plan.values.length - 1), 'linear interpolation');
                    writes++;
                }
                complete++;
            }
        } catch (error) {
            fail(String(error.message || error) + ' ' + complete + ' clips completed; the current clip may be partially changed. Use Premiere Undo to restore changes before retrying.');
        }
        return { affectedClips: complete, keyframesWritten: writes, message: 'Applied animation to ' + complete + ' video clip' + (complete === 1 ? '.' : 's.') };
    }

    function transform(payload) {
        var state = mutationContext(payload);
        var change = payload.change;
        if (!change || !/^(position|scale|rotation|opacity)$/.test(change.property)) fail('Unknown transform property.');
        validateValue(change.value, change.property);
        if (change.property === 'position') {
            number(change.value[0], -4, 5, 'horizontal position');
            number(change.value[1], -4, 5, 'vertical position');
        } else if (change.property === 'opacity') number(change.value, 0, 100, 'opacity');
        else if (change.property === 'scale') number(change.value, 0.1, 1000, 'scale');
        else number(change.value, -3600, 3600, 'rotation');
        var parameters = [];
        var index;
        for (index = 0; index < state.clips.length; index++) {
            var parameter = getParameter(state.clips[index], change.property);
            validateValue(parameter.getValue(), change.property);
            if (parameter.isTimeVarying()) fail('The selected ' + change.property + ' property is animated. Static adjustments would replace animation.');
            parameters.push(parameter);
        }
        try {
            for (index = 0; index < parameters.length; index++) successful(parameters[index].setValue(change.value, true), 'transform value');
        } catch (error) {
            fail(String(error.message || error) + ' Some clips may have changed. Use Premiere Undo before retrying.');
        }
        return { affectedClips: parameters.length, keyframesWritten: 0, message: 'Updated ' + change.property + ' on ' + parameters.length + ' video clip' + (parameters.length === 1 ? '.' : 's.') };
    }

    function dispatch(input) {
        try {
            var request = ZMotionJson.parse(input);
            if (!request || request.protocol !== 1 || !request.payload || typeof request.payload !== 'object') fail('Unsupported Z Motion request.');
            var result;
            if (request.operation === 'inspect') result = inspect();
            else if (request.operation === 'animate') result = animate(request.payload);
            else if (request.operation === 'transform') result = transform(request.payload);
            else fail('Unknown Z Motion operation.');
            return ZMotionJson.stringify({ protocol: 1, ok: true, data: result });
        } catch (error) {
            return ZMotionJson.stringify({ protocol: 1, ok: false, error: String(error.message || error) });
        }
    }

    return { dispatch: dispatch };
}());
