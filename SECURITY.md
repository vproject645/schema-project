# Security Policy

Schema handles uploaded project PDFs, approvals and optional email, so security reports are taken seriously.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private reporting instead: open the **Security** tab of this repository and choose **Report a vulnerability**.

Include what you found, the steps to reproduce it and the impact you expect. You will get an acknowledgement as soon as the report is read, and a fix or a clear explanation afterwards.

## Handling secrets

Never commit credentials. Keys such as `MODEL_API_KEY` belong in the ignored `.dev.vars` file locally and in Worker secrets when hosted. See [.env.example](.env.example) and [DEPLOY.md](DEPLOY.md).
