const router = require('lieko-express').Router();

//SSE Route example, you can add middleware too
router.get('/event', (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no" // nginx: disable buffering
    });

    res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);

    let counter = 0;

    // Send an event every second
    const interval = setInterval(() => {
        const payload = {
            counter: counter++,
            time: new Date().toISOString(),
        };

        // Write SSE message
        res.write(`event: tick\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }, 1000);

    // When the client disconnects
    req.on("close", () => {
        clearInterval(interval);
    });
});

router.get('/sse-light', (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });

    setInterval(() => {
        res.write(`data: ${Date.now()}\n\n`);
    }, 1000);
});

module.exports = router;