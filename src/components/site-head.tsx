import { getIntegrations } from "@/lib/settings";

/**
 * Injects owner-configured head codes (Admin → Integrations): Google Analytics,
 * Search Console verification, AdSense, and any custom <head> snippet. GA / GSC
 * / AdSense are server-rendered (crawler-visible); the free-form snippet is
 * injected client-side (so pasted <script> pixels actually execute).
 */
export async function SiteHead() {
  let ga_id = "",
    gsc_verification = "",
    adsense_id = "",
    head_html = "";
  try {
    ({ ga_id, gsc_verification, adsense_id, head_html } =
      await getIntegrations());
  } catch {
    return null; // missing service key etc. — never break the page
  }

  return (
    <>
      {gsc_verification && (
        <meta name="google-site-verification" content={gsc_verification} />
      )}

      {adsense_id && (
        <meta name="google-adsense-account" content={adsense_id} />
      )}

      {ga_id && (
        <>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${ga_id}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga_id}');`,
            }}
          />
        </>
      )}

      {adsense_id && (
        <script
          async
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense_id}`}
        />
      )}

      {head_html && (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=document.createElement('template');t.innerHTML=${JSON.stringify(
              head_html,
            )};var n=t.content.childNodes;for(var i=0;i<n.length;i++){var el=n[i];if(el.tagName==='SCRIPT'){var s=document.createElement('script');for(var j=0;j<el.attributes.length;j++){s.setAttribute(el.attributes[j].name,el.attributes[j].value);}s.textContent=el.textContent;document.head.appendChild(s);}else if(el.nodeType===1){document.head.appendChild(el.cloneNode(true));}}}catch(e){}})();`,
          }}
        />
      )}
    </>
  );
}
