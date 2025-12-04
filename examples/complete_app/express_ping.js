const app = require('express')();

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.listen(3001, () => {
    console.log('Server listening on http://localhost:3001');
});
