export default function ProjectsLoading() {
  return (
    <main className="mx-auto max-w-[1600px] animate-pulse space-y-6 p-4 pb-24 md:p-7 xl:p-9 lg:pb-9">
      <div className="h-44 border border-[#dce2e6] bg-white" />
      <div className="grid gap-px border border-[#dce2e6] bg-[#e7ebed] sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 bg-white p-5">
            <div className="h-2 w-24 bg-[#e8edef]" />
            <div className="mt-5 h-8 w-16 bg-[#e8edef]" />
          </div>
        ))}
      </div>
      <div className="h-[460px] border border-[#dce2e6] bg-white" />
    </main>
  );
}
