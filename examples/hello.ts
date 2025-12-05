// npx ts-node hello.ts
// bun hello.ts

import Lieko from "../lieko-express.js";

const app = Lieko();

app.get("/", (req, res) => {
  res.redirect("/hello");
});

app.get("/ping", (req, res) => {
    res.send('pong')
})

app.get("/hello", (req, res) => {
  res.ok("Hello TypeScript!");
});

const PORT = 3000
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
