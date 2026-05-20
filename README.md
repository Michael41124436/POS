# Online POS Starter

A simple online point-of-sale application built with Node.js and Express.

## Features

- Inventory display
- Add products to cart
- Complete sales
- Sales history view
- JSON persistence in `data.json`

## Setup

1. Open a terminal in `c:\Users\ADMIN\Desktop\michael`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm start
   ```
4. Open `http://localhost:4000` in your browser.

## Notes

- The backend API is in `server.js`
- Static UI files are in `public/`
- Product and sale data are stored in `data.json`

## Next enhancements

- Add user authentication
- Add product creation/editing UI
- Add barcode scanning support
- Add payment processing

## Deploying to GitHub + Render

1. Push the repository to GitHub (create a new repo, then run):

```bash
git add .
git commit -m "Prepare for deploy"
git branch -M main
git remote add origin <your-git-remote-url>
git push -u origin main
```

2. On Render (https://render.com):
   - Create a new **Web Service** and connect your GitHub repo.
   - Choose `Node` runtime.
   - Build command: `npm install`
   - Start command: `npm start`
   - Add the required environment variables (`DEFAULT_ADMIN_PW`, SMTP and Stripe keys) in the Render Dashboard.
   - Enable auto-deploy on push if desired.

3. Alternatively, add `render.yaml` to the repo to describe the service (example `render.yaml` included).

If you want, I can create the GitHub repository and push these changes for you (I will need the remote repo URL or GitHub access).
