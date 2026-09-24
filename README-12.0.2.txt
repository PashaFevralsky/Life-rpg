Life RPG 12.0.2 Cleanup — PHONE INSTALL

You only need to upload TWO files.

1. Upload cleanup-12.0.2.mjs to the ROOT of the repository.
2. Replace .github/workflows/deploy-pages.yml with the file deploy-pages.yml from this archive.

Then do nothing else.

What happens automatically:
- GitHub Actions runs cleanup-12.0.2.mjs.
- The script updates the app to 12.0.2, synchronizes package-lock, adds tests, and changes CI to npm ci.
- It replaces deploy-pages.yml with the final normal deployment workflow.
- It deletes cleanup-12.0.2.mjs from the repository.
- GitHub Actions commits the cleanup to main.
- That commit starts the normal full test/build/E2E/Pages deployment.

Do NOT upload deploy-pages-final.yml. It is included only as a fallback/reference.

STATE_VERSION stays 18. The script does not clear or migrate local user data.
