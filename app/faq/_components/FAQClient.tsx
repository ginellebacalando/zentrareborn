'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, MessageCircle, Search } from 'lucide-react';

const STATIC_FAQS = [
  {
    id: 'faq-1',
    question: 'What are your modes of payment?',
    answer: 'We accept Cash, Check, Card, and Bank Transfer payments.'
  },
  {
    id: 'faq-2',
    question: 'What is the capacity of your venue?',
    answer: 'Our venue comfortably accommodates 50 to 120 guests, with 100 guests being the ideal capacity for the best guest experience.'
  },
  {
    id: 'faq-3',
    question: 'Where are you located?',
    answer: 'We are located in San Pedro, Laguna, just minutes from the South Luzon Expressway (SLEX), making us easily accessible for guests from Metro Manila and nearby provinces.'
  },
  {
    id: 'faq-4',
    question: 'Is there a backup venue in case of rain?',
    answer: 'Yes. Our elegant Selah Indoor Hall is located right beside the garden, allowing your celebration to continue beautifully, rain or shine.'
  },
  {
    id: 'faq-5',
    question: 'Can we customize our package?',
    answer: "Absolutely. We understand that every wedding is unique, so we're happy to customize selected package inclusions to better fit your vision."
  },
  {
    id: 'faq-6',
    question: 'Are pets allowed?',
    answer: 'Yes! pets are welcome to be part of your special day. We simply ask that they wear diapers during the event.'
  }
];

export default function FAQClient() {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>('faq-1');

  const filteredFaqs = useMemo(() => {
    if (!search.trim()) return STATIC_FAQS;
    const lowerSearch = search.toLowerCase();
    return STATIC_FAQS.filter(
      (faq) =>
        faq.question.toLowerCase().includes(lowerSearch) ||
        faq.answer.toLowerCase().includes(lowerSearch)
    );
  }, [search]);

  return (
    <div className="w-full relative z-10 bg-transparent pb-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pt-20 lg:grid-cols-[1fr_340px]">
        
        {/* Main FAQ Section */}
        <section className="flex flex-col items-center">
          <div className="text-center mb-12" style={{ animation: 'fadeInUp 0.8s ease-out both' }}>
            <span className="bg-gradient-to-r from-[#D4AF37] to-[#ECDD77] text-white px-5 py-2 rounded-full text-xs font-bold tracking-[0.2em] uppercase shadow-md mb-6 inline-block">
              Got Questions?
            </span>
            <h2 className="font-serif text-4xl text-[#3A4B3C] md:text-5xl mt-2">
              Frequently Asked Questions
            </h2>
          </div>

          {/* Search Bar */}
          <div 
            className="mb-10 flex w-full flex-col gap-3 rounded-full border border-[#D4AF37]/30 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md p-2 md:flex-row transition-all focus-within:shadow-[0_20px_40px_rgba(212,175,55,0.15)] focus-within:border-[#D4AF37]/60"
            style={{ animation: 'fadeInUp 0.8s ease-out 0.2s both' }}
          >
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-6 top-3.5 h-5 w-5 text-[#3A4B3C]/50" />
              <input
                type="text"
                placeholder="Search for an answer..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-full border-none bg-transparent py-3.5 pl-14 pr-6 font-serif text-lg text-[#3A4B3C] outline-none placeholder:text-[#3A4B3C]/50"
              />
            </label>
          </div>

          {/* FAQ List */}
          <div className="flex w-full flex-col gap-5">
            {filteredFaqs.length === 0 ? (
              <div 
                className="rounded-[2rem] border border-[#D4AF37]/20 bg-white/70 px-8 py-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md"
                style={{ animation: 'fadeIn 0.5s ease-out both' }}
              >
                <p className="font-serif text-2xl text-[#3A4B3C] mb-2">No answers found.</p>
                <p className="font-serif text-lg text-neutral-500">
                  We couldn&apos;t find anything matching &ldquo;{search}&rdquo;.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <Link href="/contact" className="inline-flex items-center gap-2 rounded-full border-2 border-[#D4AF37] px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-white transition-colors duration-300">
                    <MessageCircle className="h-4 w-4" />
                    Contact Us
                  </Link>
                </div>
              </div>
            ) : (
              filteredFaqs.map((faq, index) => {
                const isOpen = openId === faq.id;
                return (
                  <article 
                    id={faq.id} 
                    key={faq.id} 
                    className={`scroll-mt-32 overflow-hidden rounded-[2rem] border transition-all duration-500 backdrop-blur-md ${
                      isOpen 
                        ? 'bg-white/90 border-[#D4AF37]/40 shadow-[0_20px_40px_rgba(212,175,55,0.15)] -translate-y-1' 
                        : 'bg-white/70 border-[#D4AF37]/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:bg-white/90 hover:shadow-[0_15px_35px_rgba(212,175,55,0.1)] hover:-translate-y-1'
                    }`}
                    style={{ animation: `fadeInUp 0.6s ease-out ${0.3 + (index * 0.1)}s both` }}
                  >
                    <button 
                      type="button" 
                      onClick={() => setOpenId(isOpen ? null : faq.id)} 
                      className="flex w-full items-center justify-between gap-6 px-8 py-7 text-left focus:outline-none"
                    >
                      <span className={`block font-serif text-xl md:text-2xl transition-colors duration-300 ${isOpen ? 'text-[#D4AF37]' : 'text-[#3A4B3C]'}`}>
                        {faq.question}
                      </span>
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                        isOpen 
                          ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37] rotate-180 shadow-inner' 
                          : 'border-[#3A4B3C]/20 text-[#3A4B3C]/60 hover:border-[#3A4B3C]/40 hover:text-[#3A4B3C] bg-transparent'
                      }`}>
                        <ChevronDown className="h-6 w-6" />
                      </span>
                    </button>
                    
                    <div 
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-8 pb-8 pt-2">
                          <div className="w-12 h-[2px] bg-[#D4AF37]/40 mb-6 rounded-full"></div>
                          <p className="whitespace-pre-wrap font-serif text-lg leading-[1.8] text-neutral-600">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-6 pt-4 lg:pt-32" style={{ animation: 'fadeInUp 0.8s ease-out 0.5s both' }}>
          
          {/* Quick Contact Card */}
          <section className="relative overflow-hidden rounded-[2rem] border border-[#D4AF37]/20 bg-white/70 backdrop-blur-md p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(212,175,55,0.15)] transition-all duration-500 hover:-translate-y-2 group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#D4AF37]/15 to-transparent rounded-full blur-2xl -mr-12 -mt-12 transition-transform duration-700 group-hover:scale-150"></div>
            
            <h3 className="font-serif text-2xl font-bold text-[#3A4B3C] mb-3 relative z-10 group-hover:text-[#D4AF37] transition-colors">Need More Help?</h3>
            <p className="font-serif text-neutral-600 mb-8 relative z-10 leading-relaxed">
              Can&apos;t find the answer you&apos;re looking for? Reach out to our team.
            </p>
            
            <div className="flex flex-col gap-4 relative z-10">
              <Link 
                href="/contact" 
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#D4AF37] px-6 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-white transition-colors duration-300"
              >
                <MessageCircle className="h-4 w-4" />
                Contact Us
              </Link>
            </div>
          </section>

          {/* Info Card */}
          <section className="relative overflow-hidden rounded-[2rem] border border-[#D4AF37]/20 bg-white/70 backdrop-blur-md p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(212,175,55,0.15)] transition-all duration-500 hover:-translate-y-2 group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#D4AF37]/15 to-transparent rounded-full blur-2xl -mr-12 -mt-12 transition-transform duration-700 group-hover:scale-150"></div>
            
            <h3 className="font-serif text-2xl font-bold text-[#3A4B3C] mb-3 relative z-10 group-hover:text-[#D4AF37] transition-colors">Venue Viewings</h3>
            <p className="font-serif text-neutral-600 leading-relaxed mb-8 relative z-10">
              We highly encourage ocular visits so you can experience the elegance of Zion Events Place in person.
            </p>
            <Link 
              href="/contact" 
              className="inline-flex items-center text-sm font-bold uppercase tracking-[0.2em] text-[#D4AF37] border-b-[1.5px] border-[#D4AF37]/40 pb-1 hover:border-[#D4AF37] hover:text-[#3A4B3C] transition-colors duration-300 relative z-10"
            >
              Arrange a Visit <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
