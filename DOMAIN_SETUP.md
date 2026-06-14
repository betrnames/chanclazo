## Resolving Netlify Custom Domain Conflict for chanclazo.com (Namecheap DNS)

Your DNS is on Namecheap and you've removed the Bolt records - good, DNS is clean.

The error "conflicting custom domain in another account" is because Bolt.new uses Netlify for hosting. The domain chanclazo.com is still registered/claimed inside the Netlify account that Bolt created for your project.

### 1. Remove from Bolt side (if accessible)
- Log into bolt.new with the account used for the project.
- Open the project.
- Go to hosting, deploy, or custom domains settings.
- Remove chanclazo.com (and www if present).
- Wait 5-10 mins and try adding in your main Netlify site.

### 2. Contact Netlify Support (if above fails)
From your main Netlify account (the one with the working site):

- Click ? (help) bottom right > Contact support.
- Ticket subject: Release conflicting custom domain chanclazo.com from another account (Bolt.new)
- Body (copy/adapt):

I used Bolt.new which associated chanclazo.com with another Netlify account.

I have removed the project from Bolt and cleaned DNS in Namecheap (Namecheap account: [your namecheap login]).

Please release the domain so I can add it to my primary site: [your netlify site url].

Proof of ownership: DNS on Namecheap, screenshot attached.

Attach screenshot of Namecheap DNS for the domain (should be clean now).

Netlify support can release it.

### 3. Add domain in Netlify once released
In your Netlify site > Domain management > Add custom domain > chanclazo.com

Netlify will show the exact records to add in Namecheap.

### 4. DNS in Namecheap
- Go to Namecheap > Advanced DNS for chanclazo.com
- Add what Netlify tells you:
  - Usually CNAME for www.chanclazo.com pointing to the Netlify target (e.g. your-site.netlify.app).
  - For apex (chanclazo.com or @): Use URL redirect to www.chanclazo.com, or the A records Netlify provides for apex.
- Save.
- Use https://dnschecker.org to check propagation (select Namecheap or your location).
- Local flush: On Windows, open CMD as admin: ipconfig /flushdns

### 5. Netlify cache
In Netlify dashboard for the site:
- Go to Deploys or Site settings > there is usually a "Purge cache" or "Clear cache" button.
- Or in individual deploy, options to invalidate.

### 6. Once live
- https://chanclazo.com should serve your Netlify site.
- The GitHub Actions (deploy-netlify.yml) will deploy on push to this site.
- With netlify.toml proxies and relative API paths, API calls will also work under the domain (proxied to your Cloudflare Worker).

Bolt showing subdomain: Because DNS or the deploy is still partially tied to Bolt's hosting. Once DNS points fully to Netlify and domain is added to your site, it will resolve to the custom domain.

If after support the domain is free but still errors, make sure you're adding it to the correct Netlify site (the one your GH secrets point to via NETLIFY_SITE_ID).

The automation is ready - just needs the domain unblocked in Netlify.

Paste any exact error or what Netlify shows when trying to add the domain.
