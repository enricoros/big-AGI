To simplify hosting, or running locally, the project can be bundled and run in a docker container.


Steps:
* Pull docker reference label

* build container

** update .env file with API and ORG keys.

** docker build . -t chatgpt

* run service
** docker run -p 8080:3000   -d chatgpt

** API key is optional, UI will prompt if missing

* Browse to http://localhost:8080 to use


NOTE:  API key is passed to the browser.
