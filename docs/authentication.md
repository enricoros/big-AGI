### Authentication with NextAuth.js 🔐

To protect the web app owner from incurring unauthorized costs when deploying the app with a backend API
key (`OPENAI_API_KEY`), you can set up basic authentication using [NextAuth.js](https://next-auth.js.org/).

#### Configuration

Update your `.env` file or Environment Variables with the following variables:

```
# [Optional] Set the authentication type to "credential" to enable basic username/password authentication
AUTH_TYPE=credential

# [Required if AUTH_TYPE == credential] Define credentials for users - you can declare up to 100 users
AUTH_USER_0=your_username
AUTH_PASSWORD_0=your_password
AUTH_USER_1=...
AUTH_PASSWORD_1=...
...

# [Required if AUTH_TYPE == credential and *not in development mode*] See: https://next-auth.js.org/configuration/options#nextauth_url
NEXTAUTH_URL=https://example.com

# [Required if AUTH_TYPE == credential] See: https://next-auth.js.org/configuration/options#secret
NEXTAUTH_SECRET=your_nextauth_secret
```

You can add multiple users by incrementing the index, e.g., `AUTH_USER_1`, `AUTH_PASSWORD_1`, and so on. They do not
need to be contiguous.

#### Usage

Once you have set up basic authentication, users will be prompted to enter their credentials when accessing the app.
Only users with valid credentials will be able to use the app and make requests to the OpenAI API.

For more information on configuring and using NextAuth.js, refer to
the [official documentation](https://next-auth.js.org/).