import { TailorForm } from "@/components/tailor-form";

// Server Component: the static text is rendered on the server. Only the form needs
// the browser (state, drag and drop), so only TailorForm is a Client Component.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8 md:py-12">
      <p className="font-heading text-xl font-semibold">CV Tailor</p>
      <h1 className="mt-10 max-w-[20ch] font-heading text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
        Fit your CV to the job.
      </h1>
      <p className="mt-4 max-w-[60ch] text-lg text-slate">
        Add your CV and the job posting. Nothing leaves your browser in this
        version.
      </p>
      <TailorForm />
    </main>
  );
}
