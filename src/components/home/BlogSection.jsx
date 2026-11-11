import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import forestStreamImg from "@/assets/images/blog-forest-stream.jpg";
import jeepMudImg from "@/assets/images/blog-jeep-mud.jpg";
import { Reveal, SectionHeading } from "./shared";

const posts = [
  {
    category: "Planning",
    readTime: "6 min read",
    date: "Oct 2026",
    title: "How much slack to leave in a travel day",
    excerpt:
      "A packed itinerary looks great on paper and falls apart by 3pm. Here’s how we think about buffers, rest and the long lunch.",
    image: forestStreamImg,
  },
  {
    category: "Budget",
    readTime: "4 min read",
    date: "Sep 2026",
    title: "Where trip budgets actually go (it’s rarely the flights)",
    excerpt:
      "Small daily costs — autos, snacks, entry fees — add up faster than most people expect. A simple way to plan for them.",
    image: jeepMudImg,
  },
];

export function BlogSection() {
  return (
    <section
      id="blog"
      className="scroll-mt-20 bg-white px-5 py-24 sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Journal"
          title="Notes on travelling well"
          description="Short, practical pieces from the people building TripMate."
        />

        <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-8">
          {posts.map((post, idx) => (
            <Reveal key={post.title} delay={idx * 0.08}>
              <Link to="/explore" className="group block">
                <div className="aspect-[16/10] overflow-hidden rounded-3xl bg-neutral-100">
                  <img
                    src={post.image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                  />
                </div>
                <div className="mt-6 flex items-center gap-3 text-xs text-neutral-500">
                  <span className="rounded-full border border-neutral-200 px-2.5 py-0.5 font-medium text-neutral-700">
                    {post.category}
                  </span>
                  <span>{post.date}</span>
                  <span aria-hidden>·</span>
                  <span>{post.readTime}</span>
                </div>
                <h3 className="mt-3 flex items-start justify-between gap-4 font-display text-2xl leading-tight tracking-tight text-neutral-950 sm:text-3xl">
                  <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 group-hover:bg-[length:100%_1px]">
                    {post.title}
                  </span>
                  <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-neutral-400 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neutral-950" />
                </h3>
                <p className="mt-3 max-w-lg text-base leading-relaxed text-neutral-500">
                  {post.excerpt}
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default BlogSection;
