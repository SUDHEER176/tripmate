import { MotionConfig } from "framer-motion";
import { IndoTraviHero } from "@/components/hero/IndoTraviHero";
import { IndonesianTourismSection } from "@/components/home/IndonesianTourismSection";
import { HowItWorksSection } from "@/components/home/HowItWorksSection";
import { TourPackagesSection } from "@/components/home/TourPackagesSection";
import { TestimonialSection } from "@/components/home/TestimonialSection";
import { BlogSection } from "@/components/home/BlogSection";
import { ProductPreviewSection } from "@/components/home/ProductPreviewSection";
import { FaqSection } from "@/components/home/FaqSection";
import { IndoTraviFooter } from "@/components/layout/IndoTraviFooter";

export function LandingPage() {
  return (
    // Respect the OS "reduce motion" setting for every animation on the page
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white text-neutral-950">
        <IndoTraviHero />
        <IndonesianTourismSection />
        <HowItWorksSection />
        <ProductPreviewSection />
        <TourPackagesSection />
        <TestimonialSection />
        <BlogSection />
        <FaqSection />
        <IndoTraviFooter />
      </div>
    </MotionConfig>
  );
}

export default LandingPage;
