var ZMotionRanges = typeof ZMotionRanges !== 'undefined' ? ZMotionRanges : {};
var ZMotion = (function () {
    var ticksPerSecond = 254016000000;

    function fail(message) { throw new Error(message); }
    function isArray(value) { return Object.prototype.toString.call(value) === '[object Array]'; }
    function numeric(value) {
        if (typeof value === 'number') return isFinite(value);
        return isArray(value) && value.length === 2 && typeof value[0] === 'number' && isFinite(value[0]) && typeof value[1] === 'number' && isFinite(value[1]);
    }
    function close(first, second) {
        if (typeof first === 'number' && typeof second === 'number') return Math.abs(first - second) <= Math.max(0.0000001, Math.abs(second) * 0.00000001);
        return isArray(first) && isArray(second) && first.length === second.length && close(first[0], second[0]) && close(first[1], second[1]);
    }
    function storedValueMatches(actual, expected) {
        if (typeof actual !== 'number' || typeof expected !== 'number') return close(actual, expected);
        return isFinite(actual) && isFinite(expected) && Math.abs(actual - expected) <= Math.max(0.00001, Math.abs(expected) * 0.0000001);
    }
    function valueMismatch(keyTime, expected, actual) {
        return 'Premiere did not preserve the generated value at ' + keyTime.seconds + 's. Requested: ' + ZMotionJson.stringify(expected) + '. Stored: ' + ZMotionJson.stringify(actual) + '.';
    }
    function time(ticks) {
        if (typeof ticks !== 'string' || !/^-?(0|[1-9][0-9]{0,20})$/.test(ticks)) fail('Invalid keyframe time.');
        var result = new Time();
        result.ticks = ticks;
        return result;
    }
    function sameTime(first, second) {
        var tolerance = Math.max(8, Math.abs(Number(second.ticks)) * 0.00000000000000023);
        return String(first.ticks) === String(second.ticks) || Math.abs(Number(first.ticks) - Number(second.ticks)) <= tolerance;
    }
    function keyIn(keys, requested) {
        var index;
        if (!keys) return null;
        for (index = 0; index < keys.length; index++) if (sameTime(keys[index], requested)) return keys[index];
        return null;
    }
    function keyArgument(keyTime, mode) { return mode === 'seconds' ? keyTime.seconds : keyTime; }
    function removeNativeKey(parameter, keyTime, mode) {
        var modes = [mode, mode === 'seconds' ? 'time' : 'seconds'];
        var index;
        var lastResult;
        for (index = 0; index < modes.length; index++) {
            try { lastResult = parameter.removeKey(keyArgument(keyTime, modes[index])); }
            catch (error) { lastResult = String(error.message || error); }
            if (!keyIn(parameter.getKeys(), keyTime)) return;
        }
        fail('Premiere did not remove the intermediate keyframe at ' + keyTime.seconds + 's. Native result: ' + String(lastResult) + '.');
    }
    function ensureNativeKey(parameter, requested, mode) {
        var before = parameter.getKeys();
        var existing = keyIn(before, requested);
        if (existing) return { time: existing, mode: mode };
        var modes = [mode, mode === 'seconds' ? 'time' : 'seconds'];
        var attempt;
        var index;
        var lastResult;
        for (attempt = 0; attempt < modes.length; attempt++) {
            try { lastResult = parameter.addKey(keyArgument(requested, modes[attempt])); }
            catch (error) { lastResult = String(error.message || error); }
            var after = parameter.getKeys();
            if (after) {
                for (index = 0; index < after.length; index++) {
                    if (!keyIn(before, after[index]) && !sameTime(after[index], requested)) removeNativeKey(parameter, after[index], modes[attempt]);
                }
            }
            var created = keyIn(parameter.getKeys(), requested);
            if (created) return { time: created, mode: modes[attempt] };
        }
        fail('Premiere did not create the intermediate keyframe at ' + requested.seconds + 's. Native result: ' + String(lastResult) + '.');
    }
    function setNativeValue(parameter, keyTime, value, mode, updateUI) {
        var result = parameter.setValueAtKey(keyArgument(keyTime, mode), value, updateUI);
        var actual = parameter.getValueAtKey(keyTime);
        if (!storedValueMatches(actual, value)) fail(valueMismatch(keyTime, value, actual) + ' Native result: ' + String(result) + '.');
    }
    function setLinear(parameter, keyTime, mode, updateUI) {
        var modes = [mode, mode === 'seconds' ? 'time' : 'seconds'];
        var index;
        var result;
        for (index = 0; index < modes.length; index++) {
            try {
                result = parameter.setInterpolationTypeAtKey(keyArgument(keyTime, modes[index]), 0, updateUI);
                if (result === undefined || result === 0 || result === true) return;
            } catch (error) { result = String(error.message || error); }
        }
        fail('Premiere rejected linear interpolation at ' + keyTime.seconds + 's. Native result: ' + String(result) + '.');
    }
    function clipContext() {
        var project = app.project;
        var sequence = project && project.activeSequence;
        if (!sequence) return { message: 'Open a sequence and select one video clip.' };
        var selection = sequence.getSelection();
        var clips = [];
        var index;
        for (index = 0; index < selection.length; index++) if (selection[index].mediaType === 'Video') clips.push(selection[index]);
        if (clips.length !== 1) return { message: 'Select one video clip in the timeline.' };
        var clip = clips[0];
        return {
            sequence: sequence, clip: clip,
            identity: [String(project.documentID || project.path || ''), String(sequence.sequenceID), String(clip.nodeId)],
            message: ''
        };
    }
    function curveContext(selected) {
        if (!selected.sequence) return selected;
        var clip = selected.clip;
        var sequence = selected.sequence;
        if (typeof clip.getSpeed !== 'function' || Math.abs(clip.getSpeed() - 1) > 0.000001 || (typeof clip.isSpeedReversed === 'function' && clip.isSpeedReversed())) return { message: 'Use a forward clip at 100% speed for this version.' };
        var sourceCursor = clip.inPoint.seconds + sequence.getPlayerPosition().seconds - clip.start.seconds;
        return {
            sequence: sequence, clip: clip, sourceCursor: sourceCursor,
            frameTicks: String(sequence.timebase),
            identity: selected.identity,
            message: 'Place the playhead between two existing keyframes.'
        };
    }
    function context() { return curveContext(clipContext()); }
    function findPair(keys, cursor, preferred) {
        var index;
        var first = null;
        var last = null;
        if (preferred) {
            for (index = 0; index < keys.length; index++) {
                if (String(keys[index].ticks) === preferred.startTicks) first = keys[index];
                if (String(keys[index].ticks) === preferred.endTicks) last = keys[index];
            }
            if (first && last && cursor >= first.seconds - 0.000001 && cursor <= last.seconds + 0.000001 && last.seconds > first.seconds) return [first, last];
        }
        for (index = 0; index < keys.length - 1; index++) {
            if (cursor >= keys[index].seconds - 0.000001 && cursor < keys[index + 1].seconds - 0.000001) return [keys[index], keys[index + 1]];
        }
        if (keys.length > 1 && Math.abs(cursor - keys[keys.length - 1].seconds) < 0.000001) return [keys[keys.length - 2], keys[keys.length - 1]];
        return null;
    }
    function kind(component, parameterIndex, value) {
        if (isArray(value)) return 'position';
        if (/^(AE\.)?ADBE Opacity$/.test(component.matchName) && parameterIndex === 0) return 'opacity';
        if (/^(AE\.)?ADBE Motion$/.test(component.matchName)) {
            if (parameterIndex === 1 || parameterIndex === 2) return 'scale';
            if (parameterIndex === 4) return 'rotation';
        }
        return 'value';
    }
    function rangeToken(state, componentIndex, parameterIndex, parameter, keys, pair) {
        var entries = [];
        var index;
        for (index = 0; index < keys.length; index++) {
            if (keys[index].seconds >= pair[0].seconds - 0.000001 && keys[index].seconds <= pair[1].seconds + 0.000001) entries.push([String(keys[index].ticks), parameter.getValueAtKey(keys[index])]);
        }
        var component = state.clip.components[componentIndex];
        var descriptor = [componentIndex, parameterIndex, String(component.matchName), String(parameter.displayName), state.clip.components.numItems, component.properties.numItems];
        return ZMotionJson.stringify([state.identity, descriptor, state.clip.start.seconds, state.clip.end.seconds, state.clip.inPoint.seconds, state.frameTicks, entries]);
    }
    function describeTarget(state, componentIndex, parameterIndex, preferred) {
        var component = state.clip.components[componentIndex];
        var parameter = component.properties[parameterIndex];
        if (!parameter.areKeyframesSupported() || !parameter.isTimeVarying()) return null;
        var keys = parameter.getKeys();
        if (!keys || keys.length < 2 || keys.length > 10000) return null;
        keys.sort(function (first, last) { return first.seconds - last.seconds; });
        var id = ZMotionJson.stringify([state.identity, componentIndex, parameterIndex]);
        var reference = preferred && preferred.id === id ? preferred : ZMotionRanges[id];
        var pair = findPair(keys, state.sourceCursor, reference);
        if (!pair) return null;
        var first = parameter.getValueAtKey(pair[0]);
        var last = parameter.getValueAtKey(pair[1]);
        if (!numeric(first) || !numeric(last) || typeof first !== typeof last) return null;
        var valueKind = kind(component, parameterIndex, first);
        var target = {
            id: id, label: String(component.displayName || component.matchName) + ' / ' + String(parameter.displayName), kind: valueKind,
            startTicks: String(pair[0].ticks), endTicks: String(pair[1].ticks), frameTicks: state.frameTicks,
            startValue: first, endValue: last,
            rangeToken: rangeToken(state, componentIndex, parameterIndex, parameter, keys, pair)
        };
        if (valueKind === 'opacity') target.limits = [0, 100];
        return { target: target, parameter: parameter, keys: keys };
    }
    function collect(state, preferred) {
        var candidates = [];
        if (!state.sequence) return candidates;
        var componentIndex;
        var parameterIndex;
        for (componentIndex = 0; componentIndex < state.clip.components.numItems; componentIndex++) {
            var properties = state.clip.components[componentIndex].properties;
            for (parameterIndex = 0; parameterIndex < properties.numItems; parameterIndex++) {
                try {
                    var entry = describeTarget(state, componentIndex, parameterIndex, preferred);
                    if (entry) candidates.push(entry);
                } catch (error) { continue; }
            }
        }
        return candidates;
    }
    function inspect(payload) {
        var selected = clipContext();
        var candidates = [];
        var message = selected.message;
        try {
            var state = curveContext(selected);
            candidates = collect(state, payload.preferred);
            message = state.message;
        } catch (error) { message = String(error.message || error); }
        var targets = [];
        var index;
        for (index = 0; index < candidates.length; index++) targets.push(candidates[index].target);
        return { hostVersion: String(app.version), targets: targets, message: targets.length ? '' : message, motionBlur: inspectMotionBlur(selected) };
    }
    function normalizedLabel(value) {
        return String(value || '').toLowerCase().replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c').replace(/[’‘]/g, "'").replace(/^\s+|\s+$/g, '');
    }
    function shutterValue(parameter) {
        var value = parameter.getValue();
        if (typeof value !== 'number' || !isFinite(value) || value < 0 || value > 360) fail('Premiere returned an unsupported Transform shutter angle.');
        return value;
    }
    function checkboxValue(parameter) {
        var value = parameter.getValue();
        if (value !== true && value !== false && value !== 0 && value !== 1) fail('Premiere returned an unsupported composition shutter setting.');
        return value;
    }
    function describeMotionBlur(state, componentIndex) {
        var component = state.clip.components[componentIndex];
        if (!/^(AE\.)?ADBE Geometry2?$/.test(component.matchName)) {
            if (/^(transform|transformar|transformacao)$/.test(normalizedLabel(component.displayName))) fail('Transform was found, but this effect version is not supported: ' + String(component.matchName) + '.');
            return null;
        }
        var properties = component.properties;
        var angleIndex = -1;
        var compositionIndex = -1;
        var descriptors = [];
        var index;
        for (index = 0; index < properties.numItems; index++) {
            var name = normalizedLabel(properties[index].displayName);
            descriptors.push(String(properties[index].displayName));
            if (/^(shutter angle|angulo do obturador)$/.test(name)) {
                if (angleIndex !== -1) fail('Transform has ambiguous shutter angle controls.');
                angleIndex = index;
            }
            if (/^(use (composition|composite)('s)? shutter angle|usar angulo (do|de) obturador da composicao)$/.test(name)) {
                if (compositionIndex !== -1) fail('Transform has ambiguous composition shutter controls.');
                compositionIndex = index;
            }
        }
        if (compositionIndex === -1 && angleIndex === 10 && properties.numItems >= 11 && properties.numItems <= 12 && normalizedLabel(properties[9].displayName) === '') compositionIndex = 9;
        if (angleIndex === -1 || compositionIndex === -1) fail('This Transform layout or language is not supported for motion blur. Use its shutter controls in Effect Controls.');
        var angle = properties[angleIndex];
        var composition = properties[compositionIndex];
        if (angle.isTimeVarying() || composition.isTimeVarying()) fail('Transform shutter controls have keyframes. Adjust them in Effect Controls to preserve that animation.');
        var shutter = shutterValue(angle);
        var useComposition = checkboxValue(composition);
        var target = {
            id: ZMotionJson.stringify([state.identity, 'motion-blur', componentIndex]),
            label: String(component.displayName || 'Transform') + ' (' + (componentIndex + 1) + ')',
            shutterAngle: shutter,
            useCompositionShutterAngle: !!useComposition,
            stateToken: ZMotionJson.stringify([state.identity, state.clip.start.seconds, state.clip.end.seconds, state.clip.inPoint.seconds, state.clip.components.numItems, componentIndex, String(component.matchName), descriptors, angleIndex, compositionIndex, shutter, useComposition])
        };
        return { target: target, angle: angle, composition: composition, compositionValue: useComposition, componentIndex: componentIndex };
    }
    function collectMotionBlur(state) {
        var candidates = [];
        var message = 'Add the Transform effect to this clip to enable motion blur.';
        if (!state.sequence) return { candidates: candidates, message: state.message };
        var index;
        for (index = 0; index < state.clip.components.numItems; index++) {
            try {
                var candidate = describeMotionBlur(state, index);
                if (candidate) candidates.push(candidate);
            } catch (error) { message = String(error.message || error); }
        }
        return { candidates: candidates, message: message };
    }
    function inspectMotionBlur(state) {
        var found = collectMotionBlur(state);
        var targets = [];
        var index;
        for (index = 0; index < found.candidates.length; index++) targets.push(found.candidates[index].target);
        return { targets: targets, message: targets.length ? '' : found.message, clipName: state.clip ? String(state.clip.name || 'Selected clip') : '' };
    }
    function setShutterValue(parameter, value, checkbox) {
        var nativeResult;
        var nativeError = '';
        try { nativeResult = parameter.setValue(value, true); }
        catch (error) { nativeError = String(error.message || error); }
        var stored = checkbox ? checkboxValue(parameter) : shutterValue(parameter);
        if (checkbox ? !!stored !== !!value : !storedValueMatches(stored, value)) fail('Premiere did not retain the motion blur setting. Requested: ' + value + '. Stored: ' + stored + '. Native result: ' + (nativeError || String(nativeResult)) + '.');
    }
    function applyMotionBlur(payload) {
        if (!payload.target || typeof payload.target.id !== 'string' || typeof payload.target.stateToken !== 'string') fail('Load a Transform effect before applying motion blur.');
        var angle = payload.shutterAngle;
        if (typeof angle !== 'number' || !isFinite(angle) || angle < 0 || angle > 360) fail('Set the shutter angle between 0 and 360 degrees.');
        var state = clipContext();
        var found = collectMotionBlur(state);
        var candidate = null;
        var index;
        for (index = 0; index < found.candidates.length; index++) if (found.candidates[index].target.id === payload.target.id) candidate = found.candidates[index];
        if (!candidate || candidate.target.stateToken !== payload.target.stateToken) fail('The clip, Transform effect or shutter settings changed. Return to the panel to reload them.');
        var originalAngle = candidate.target.shutterAngle;
        var originalComposition = candidate.compositionValue;
        var updated;
        try {
            setShutterValue(candidate.composition, typeof originalComposition === 'boolean' ? false : 0, true);
            setShutterValue(candidate.angle, angle, false);
            updated = describeMotionBlur(state, candidate.componentIndex);
            if (!updated || updated.target.useCompositionShutterAngle || !storedValueMatches(updated.target.shutterAngle, angle)) fail('Premiere changed the motion blur settings during application.');
        } catch (error) {
            var restored = true;
            try { setShutterValue(candidate.angle, originalAngle, false); } catch (angleError) { restored = false; }
            try { setShutterValue(candidate.composition, originalComposition, true); } catch (compositionError) { restored = false; }
            try {
                if (!storedValueMatches(shutterValue(candidate.angle), originalAngle) || !!checkboxValue(candidate.composition) !== !!originalComposition) restored = false;
            } catch (readError) { restored = false; }
            fail(String(error.message || error) + (restored ? ' Previous shutter settings were restored.' : ' Shutter settings may be partially changed. Use Premiere Undo before retrying.'));
        }
        return { target: updated.target, message: angle === 0 ? 'Motion blur disabled for this Transform effect.' : 'Motion blur applied at ' + angle + ' degrees. Check playback in Premiere.' };
    }
    function interpolate(first, last, progress) {
        if (typeof first === 'number') return first + (last - first) * progress;
        return [first[0] + (last[0] - first[0]) * progress, first[1] + (last[1] - first[1]) * progress];
    }
    function validatePlan(target, plan) {
        if (!plan || !isArray(plan.curve) || plan.curve.length !== 4 || !isArray(plan.samples)) fail('Invalid curve plan.');
        var index;
        for (index = 0; index < 4; index++) {
            var coordinate = plan.curve[index];
            if (typeof coordinate !== 'number' || !isFinite(coordinate) || coordinate < (index % 2 ? -2 : 0) || coordinate > (index % 2 ? 3 : 1)) fail('Invalid curve coordinate.');
        }
        var frames = (Number(target.endTicks) - Number(target.startTicks)) / Number(target.frameTicks);
        if (Math.abs(frames - Math.round(frames)) > 0.000001 || frames < 2 || frames > 1800 || plan.samples.length !== Math.round(frames) + 1) fail('Choose frame-aligned keyframes between 2 and 1800 frames apart.');
        var samples = plan.samples;
        if (samples[0].timeTicks !== target.startTicks || samples[samples.length - 1].timeTicks !== target.endTicks || samples[0].progress !== 0 || samples[samples.length - 1].progress !== 1) fail('The curve must preserve both endpoint times.');
        for (index = 0; index < samples.length; index++) {
            var sample = samples[index];
            time(sample.timeTicks);
            if (Math.abs(Number(sample.timeTicks) - Number(target.startTicks) - index * Number(target.frameTicks)) > 8) fail('Generated keys must follow the sequence frame grid.');
            if (typeof sample.progress !== 'number' || !isFinite(sample.progress) || sample.progress < -2 || sample.progress > 3 || !numeric(sample.value) || !close(sample.value, interpolate(target.startValue, target.endValue, sample.progress))) fail('The generated values do not match the endpoint values.');
            if (target.limits && (sample.value < target.limits[0] || sample.value > target.limits[1])) fail('The curve exceeds the property range. Reduce overshoot.');
        }
    }
    function applyCurve(payload) {
        if (!payload.target || typeof payload.target.id !== 'string' || typeof payload.target.rangeToken !== 'string') fail('Load a keyframe pair before applying a curve.');
        var state = context();
        var candidates = collect(state, payload.target);
        var candidate = null;
        var index;
        for (index = 0; index < candidates.length; index++) if (candidates[index].target.id === payload.target.id) candidate = candidates[index];
        if (!candidate || candidate.target.rangeToken !== payload.target.rangeToken) fail('The keyframes or clip selection changed after the preview. Return to the panel to reload the pair.');
        var target = candidate.target;
        var parameter = candidate.parameter;
        validatePlan(target, payload.plan);
        var samples = payload.plan.samples;
        var expectedTimes = {};
        var remembered = ZMotionRanges[target.id];
        var writeMode = remembered && remembered.writeMode === 'time' ? 'time' : 'seconds';
        var protectedKeys = [];
        for (index = 0; index < candidate.keys.length; index++) {
            var original = candidate.keys[index];
            if (original.seconds <= time(target.startTicks).seconds || original.seconds >= time(target.endTicks).seconds) protectedKeys.push({ time: original, value: parameter.getValueAtKey(original) });
        }
        for (index = 1; index < samples.length - 1; index++) expectedTimes[samples[index].timeTicks] = true;
        var writes = 0;
        try {
            for (index = 0; index < candidate.keys.length; index++) {
                var existing = candidate.keys[index];
                if (existing.seconds > time(target.startTicks).seconds && existing.seconds < time(target.endTicks).seconds && !Object.prototype.hasOwnProperty.call(expectedTimes, String(existing.ticks))) removeNativeKey(parameter, existing, writeMode);
            }
            for (index = 1; index < samples.length - 1; index++) {
                var created = ensureNativeKey(parameter, time(samples[index].timeTicks), writeMode);
                writeMode = created.mode;
                setNativeValue(parameter, created.time, samples[index].value, writeMode, index === samples.length - 2);
                writes++;
            }
            var finalKeys = parameter.getKeys();
            for (index = 0; index < samples.length; index++) {
                var actual = keyIn(finalKeys, time(samples[index].timeTicks));
                if (!actual) fail('Premiere did not retain the sampled keyframe at ' + time(samples[index].timeTicks).seconds + 's.');
                var stored = parameter.getValueAtKey(actual);
                var endpoint = index === 0 || index === samples.length - 1;
                if (!(endpoint ? close(stored, samples[index].value) : storedValueMatches(stored, samples[index].value))) fail(valueMismatch(actual, samples[index].value, stored));
                setLinear(parameter, actual, writeMode, index === samples.length - 1);
            }
            for (index = 0; index < protectedKeys.length; index++) {
                var preserved = keyIn(parameter.getKeys(), protectedKeys[index].time);
                if (!preserved || !close(parameter.getValueAtKey(preserved), protectedKeys[index].value)) fail('Premiere changed an endpoint or a neighboring keyframe.');
            }
        } catch (error) {
            fail(String(error.message || error) + ' Some intermediate keys may have changed. Use Premiere Undo before retrying.');
        }
        ZMotionRanges[target.id] = { startTicks: target.startTicks, endTicks: target.endTicks, writeMode: writeMode };
        var refreshed = inspect({ preferred: target });
        var updated = target;
        for (index = 0; index < refreshed.targets.length; index++) if (refreshed.targets[index].id === target.id) updated = refreshed.targets[index];
        return { keyframesWritten: writes, message: 'Curve applied. Both endpoint values and times were preserved.', target: updated };
    }
    function dispatch(input) {
        try {
            var request = ZMotionJson.parse(input);
            if (!request || request.protocol !== 2 || !request.payload || typeof request.payload !== 'object') fail('Unsupported Z Motion request. Reinstall the current panel.');
            var result;
            if (request.operation === 'inspect') result = inspect(request.payload);
            else if (request.operation === 'apply-curve') result = applyCurve(request.payload);
            else if (request.operation === 'apply-motion-blur') result = applyMotionBlur(request.payload);
            else fail('Unknown Z Motion operation.');
            return ZMotionJson.stringify({ protocol: 2, ok: true, data: result });
        } catch (error) {
            return ZMotionJson.stringify({ protocol: 2, ok: false, error: String(error.message || error) });
        }
    }
    return { dispatch: dispatch };
}());
