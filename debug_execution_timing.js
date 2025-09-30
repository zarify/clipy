// Debug script to trace execution timing - paste this in browser console
(function debugExecutionTiming() {
    console.log('=== DEBUGGING EXECUTION TIMING ===')

    // Store original functions
    const originalAppendTerminal = window.appendTerminal
    const originalMapTraceback = window.mapTracebackAndShow || (() => { })

    // Track when things happen
    const events = []

    function logEvent(name, data = {}) {
        const event = {
            timestamp: Date.now(),
            name,
            data: JSON.stringify(data),
            lastMappedEventExists: !!(window.__ssg_last_mapped_event),
            headerLines: window.__ssg_last_mapped_event?.headerLines || 'undefined'
        }
        events.push(event)
        console.log(`[${event.timestamp}] ${name}: headerLines=${event.headerLines}, data=${event.data}`)
    }

    // Intercept appendTerminal calls
    window.appendTerminal = function (text, kind) {
        logEvent('appendTerminal_called', { kind, textPreview: text?.slice(0, 100) })
        return originalAppendTerminal.call(this, text, kind)
    }

    // Intercept mapping calls
    if (window.mapTracebackAndShow) {
        window.mapTracebackAndShow = function (...args) {
            logEvent('mapTracebackAndShow_called', { args: args.map(a => typeof a === 'string' ? a.slice(0, 50) : a) })
            const result = originalMapTraceback.apply(this, args)
            logEvent('mapTracebackAndShow_result', { resultPreview: result?.slice(0, 100) })
            return result
        }
    }

    // Intercept execution context setting
    const originalLastMappedEvent = window.__ssg_last_mapped_event
    Object.defineProperty(window, '__ssg_last_mapped_event', {
        get() { return this._ssg_last_mapped_event },
        set(value) {
            logEvent('__ssg_last_mapped_event_set', {
                headerLines: value?.headerLines,
                sourcePath: value?.sourcePath
            })
            this._ssg_last_mapped_event = value
        }
    })
    window.__ssg_last_mapped_event = originalLastMappedEvent

    console.log('Debugging hooks installed. Now run print(z) and check the timeline:')

    // Function to show results
    window.showExecutionTimeline = function () {
        console.log('\n=== EXECUTION TIMELINE ===')
        events.forEach((event, i) => {
            console.log(`${i + 1}. [+${event.timestamp - events[0].timestamp}ms] ${event.name}`)
            console.log(`   headerLines: ${event.headerLines}`)
            console.log(`   data: ${event.data}`)
        })

        // Check if headerLines was available when needed
        const appendCalls = events.filter(e => e.name === 'appendTerminal_called')
        const mappingCalls = events.filter(e => e.name === 'mapTracebackAndShow_called')

        console.log('\n=== ANALYSIS ===')
        appendCalls.forEach((call, i) => {
            console.log(`appendTerminal call ${i + 1}: headerLines was ${call.headerLines}`)
        })

        mappingCalls.forEach((call, i) => {
            console.log(`mapTracebackAndShow call ${i + 1}: headerLines was ${call.headerLines}`)
        })
    }

    console.log('After running print(z), call window.showExecutionTimeline() to see the results')
})()