// Route `/vision`: la fotocamera, raggiunta dopo il login (dal web) o
// direttamente. Su nativo `/` apre già la fotocamera; questa route serve al
// flusso "Provala → Login → App" della landing web, dove `/` è la landing page.
export { default } from '@/components/vision-screen';
