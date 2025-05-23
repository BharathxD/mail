import { matchFilterPrefix, filterSuggestionsFunction, filterSuggestions } from '@/lib/filter';
import { parseNaturalLanguageSearch, parseNaturalLanguageDate } from '@/lib/utils';
import { cn, extractFilterValue, type FilterSuggestion } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchValue } from '@/hooks/use-search-value';
import { Calendar } from '@/components/ui/calendar';
import { type DateRange } from 'react-day-picker';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Search, X } from 'lucide-react';
import { format } from 'date-fns';
import React from 'react';

const SEARCH_SUGGESTIONS = [
  '"Emails from last week..."',
  '"Emails with attachments..."',
  '"Unread emails..."',
  '"Emails from Caroline and Josh..."',
  '"Starred emails..."',
  '"Emails with links..."',
  '"Emails from last month..."',
  '"Emails in Inbox..."',
  '"Emails with PDF attachments..."',
  '"Emails delivered to me..."',
];

// function DateFilter({ date, setDate }: { date: DateRange; setDate: (date: DateRange) => void }) {
//   const t = useTranslations('common.searchBar');

//   return (
//     <div className="grid gap-2">
//       <Popover>
//         <PopoverTrigger asChild>
//           <Button
//             id="date"
//             variant={'outline'}
//             className={cn(
//               'justify-start text-left font-normal',
//               !date && 'text-muted-foreground',
//               'bg-muted/50 h-10 rounded-md',
//             )}
//           >
//             <CalendarIcon className="mr-2 h-4 w-4" />
//             {date?.from ? (
//               date.to ? (
//                 <>
//                   {format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}
//                 </>
//               ) : (
//                 format(date.from, 'LLL dd, y')
//               )
//             ) : (
//               <span>{t('pickDateRange')}</span>
//             )}
//           </Button>
//         </PopoverTrigger>
//         <PopoverContent className="w-auto rounded-md p-0" align="start">
//           <Calendar
//             initialFocus
//             mode="range"
//             defaultMonth={date?.from}
//             selected={date}
//             onSelect={(range) => range && setDate(range)}
//             numberOfMonths={useIsMobile() ? 1 : 2}
//             disabled={(date) => date > new Date()}
//           />
//         </PopoverContent>
//       </Popover>
//     </div>
//   );
// }

type SearchForm = {
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  q: string;
  dateRange: DateRange;
  category: string;
  folder: string;
  has: any;
  fileName: any;
  deliveredTo: string;
  unicorn: string;
};

export function SearchBar() {
  // const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useSearchValue();
  const [isSearching, setIsSearching] = useState(false);

  const form = useForm<SearchForm>({
    defaultValues: {
      folder: '',
      subject: '',
      from: '',
      to: '',
      cc: '',
      bcc: '',
      q: '',
      dateRange: {
        from: undefined,
        to: undefined,
      },
      category: '',
      has: '',
      fileName: '',
      deliveredTo: '',
      unicorn: '',
    },
  });

  const q = form.watch('q');

  const submitSearch = useCallback(
    async (data: SearchForm) => {
      setIsSearching(true);
      let searchTerms = [];

      try {
        if (data.q.trim()) {
          const searchTerm = data.q.trim();

          // Parse natural language date queries
          const dateRange = parseNaturalLanguageDate(searchTerm);
          if (dateRange) {
            if (dateRange.from) {
              // Format date according to Gmail's requirements (YYYY/MM/DD)
              const fromDate = format(dateRange.from, 'yyyy/MM/dd');
              searchTerms.push(`after:${fromDate}`);
            }
            if (dateRange.to) {
              // Format date according to Gmail's requirements (YYYY/MM/DD)
              const toDate = format(dateRange.to, 'yyyy/MM/dd');
              searchTerms.push(`before:${toDate}`);
            }

            // For date queries, we don't want to search the content
            const cleanedQuery = searchTerm
              .replace(/emails?\s+from\s+/i, '')
              .replace(/\b\d{4}\b/g, '')
              .replace(
                /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
                '',
              )
              .trim();

            if (cleanedQuery) {
              searchTerms.push(cleanedQuery);
            }
          } else {
            // Parse natural language search patterns
            const parsedTerm = parseNaturalLanguageSearch(searchTerm);
            if (parsedTerm !== searchTerm) {
              searchTerms.push(parsedTerm);
            } else {
              if (searchTerm.includes('@')) {
                searchTerms.push(`from:${searchTerm}`);
              } else {
                searchTerms.push(
                  `(from:${searchTerm} OR from:"${searchTerm}" OR subject:"${searchTerm}" OR "${searchTerm}")`,
                );
              }
            }
          }
        }

        // Add filters
        if (data.folder) searchTerms.push(`in:${data.folder.toLowerCase()}`);
        if (data.has) searchTerms.push(`has:${data.has.toLowerCase()}`);
        if (data.fileName) searchTerms.push(`filename:${data.fileName}`);
        if (data.deliveredTo) searchTerms.push(`deliveredto:${data.deliveredTo.toLowerCase()}`);
        if (data.unicorn) searchTerms.push(`+${data.unicorn}`);

        let searchQuery = searchTerms.join(' ');
        searchQuery = extractMetaText(searchQuery) || '';

        console.log('Final search query:', {
          value: searchQuery,
          highlight: data.q,
          folder: data.folder ? data.folder.toUpperCase() : '',
          isLoading: true,
          isAISearching: false,
        });

        setSearchValue({
          value: searchQuery,
          highlight: data.q,
          folder: data.folder ? data.folder.toUpperCase() : '',
          isLoading: true,
          isAISearching: false,
        });
      } catch (error) {
        console.error('Search error:', error);
        if (data.q) {
          const searchTerm = data.q.trim();
          const parsedTerm = parseNaturalLanguageSearch(searchTerm);
          if (parsedTerm !== searchTerm) {
            searchTerms.push(parsedTerm);
          } else {
            if (searchTerm.includes('@')) {
              searchTerms.push(`from:${searchTerm}`);
            } else {
              searchTerms.push(
                `(from:${searchTerm} OR from:"${searchTerm}" OR subject:"${searchTerm}" OR "${searchTerm}")`,
              );
            }
          }
        }
        setSearchValue({
          value: searchTerms.join(' '),
          highlight: data.q,
          folder: data.folder ? data.folder.toUpperCase() : '',
          isLoading: true,
          isAISearching: false,
        });
      } finally {
        setIsSearching(false);
      }
    },
    [setSearchValue],
  );

  const resetSearch = useCallback(() => {
    form.reset({
      folder: '',
      subject: '',
      from: '',
      to: '',
      cc: '',
      bcc: '',
      q: '',
      dateRange: {
        from: undefined,
        to: undefined,
      },
      category: '',
      has: '',
      fileName: '',
      deliveredTo: '',
      unicorn: '',
    });
    setSearchValue({
      value: '',
      highlight: '',
      folder: '',
      isLoading: false,
      isAISearching: false,
    });
  }, [form, setSearchValue]);

  return (
    <div className="relative flex-1 md:max-w-[600px]">
      <form className="relative flex items-center" onSubmit={form.handleSubmit(submitSearch)}>
        <Search className="text-muted-foreground absolute left-2.5 h-4 w-4" aria-hidden="true" />
        <div className="relative w-full">
          <Input
            placeholder={'Search...'}
            className="bg-muted-foreground/20 dark:bg-muted/50 text-muted-foreground ring-muted placeholder:text-muted-foreground/70 h-8 w-full select-none rounded-md border-none pl-9 pr-14 shadow-none transition-all duration-300"
            {...form.register('q')}
            value={q}
            disabled={isSearching}
          />
          {q && (
            <button
              type="button"
              onClick={resetSearch}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
              disabled={isSearching}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* <div className="absolute right-1 z-20 flex items-center gap-1">
          {filtering && (
            <button
              type="button"
              onClick={resetSearch}
              className="ring-offset-background focus:ring-ring rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
              disabled={isSearching}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t('common.searchBar.clearSearch')}</span>
            </button>
          )}
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'text-muted-foreground hover:bg-muted/70 hover:text-foreground h-7 w-7 rounded-md p-0',
                  popoverOpen && 'bg-muted/70 text-foreground',
                )}
                type="button"
                disabled={isSearching}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="sr-only">{t('common.searchBar.advancedSearch')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="bg-popover w-[min(calc(100vw-2rem),400px)] rounded-md border p-4 shadow-lg sm:w-[500px] md:w-[600px]"
              side="bottom"
              sideOffset={15}
              alignOffset={-8}
              align="end"
            >
              <div className="space-y-5">
                <div>
                  <h2 className="mb-3 text-xs font-semibold">
                    {t('common.searchBar.quickFilters')}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 hover:bg-muted h-7 rounded-md text-xs"
                      onClick={() => form.setValue('q', 'is:unread')}
                    >
                      {t('common.searchBar.unread')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 hover:bg-muted h-7 rounded-md text-xs"
                      onClick={() => form.setValue('q', 'has:attachment')}
                    >
                      {t('common.searchBar.hasAttachment')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 hover:bg-muted h-7 rounded-md text-xs"
                      onClick={() => form.setValue('q', 'is:starred')}
                    >
                      {t('common.searchBar.starred')}
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div className="grid gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold">
                      {t('common.searchBar.searchIn')}
                    </label>
                    <Select
                      onValueChange={(value) => form.setValue('folder', value)}
                      value={form.watch('folder')}
                    >
                      <SelectTrigger className="bg-muted/50 h-8 rounded-md capitalize">
                        <SelectValue placeholder="All Mail" />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        {FOLDER_NAMES.map((inbox) => (
                          <SelectItem key={inbox} value={inbox} className="capitalize">
                            {inbox}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold">{t('common.searchBar.subject')}</label>
                    <Input
                      placeholder={t('common.searchBar.subject')}
                      {...form.register('subject')}
                      className="bg-muted/50 h-8 rounded-md"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold">
                        {t('common.mailDisplay.from')}
                      </label>
                      <Input
                        placeholder={t('common.searchBar.sender')}
                        {...form.register('from')}
                        className="bg-muted/50 h-8 rounded-md"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold">{t('common.mailDisplay.to')}</label>
                      <Input
                        placeholder={t('common.searchBar.recipient')}
                        {...form.register('to')}
                        className="bg-muted/50 h-8 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold">
                      {t('common.searchBar.dateRange')}
                    </label>
                    <DateFilter
                      date={value.dateRange}
                      setDate={(range) => form.setValue('dateRange', range)}
                    />
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div>
                  <h2 className="mb-3 text-xs font-semibold">{t('common.searchBar.category')}</h2>
                  <div className="flex flex-wrap gap-2">
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-primary/20 h-7 rounded-md text-xs transition-colors data-[state=on]:ring-1"
                      pressed={form.watch('category') === 'primary'}
                      onPressedChange={(pressed) =>
                        form.setValue('category', pressed ? 'primary' : '')
                      }
                    >
                      {t('common.mailCategories.primary')}
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-primary/20 h-7 rounded-md text-xs transition-colors data-[state=on]:ring-1"
                      pressed={form.watch('category') === 'updates'}
                      onPressedChange={(pressed) =>
                        form.setValue('category', pressed ? 'updates' : '')
                      }
                    >
                      {t('common.mailCategories.updates')}
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-primary/20 h-7 rounded-md text-xs transition-colors data-[state=on]:ring-1"
                      pressed={form.watch('category') === 'promotions'}
                      onPressedChange={(pressed) =>
                        form.setValue('category', pressed ? 'promotions' : '')
                      }
                    >
                      {t('common.mailCategories.promotions')}
                    </Toggle>
                    <Toggle
                      variant="outline"
                      size="sm"
                      className="bg-muted/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:ring-primary/20 h-7 rounded-md text-xs transition-colors data-[state=on]:ring-1"
                      pressed={form.watch('category') === 'social'}
                      onPressedChange={(pressed) =>
                        form.setValue('category', pressed ? 'social' : '')
                      }
                    >
                      {t('common.mailCategories.social')}
                    </Toggle>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    onClick={resetSearch}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground h-8 rounded-md text-xs transition-colors"
                  >
                    {t('common.searchBar.reset')}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md text-xs shadow-none transition-colors"
                    type="submit"
                    onClick={() => setPopoverOpen(false)}
                  >
                    {t('common.searchBar.applyFilters')}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div> */}
      </form>
    </div>
  );
}

function extractMetaText(text: string) {
  // Check if the text contains a query enclosed in quotes
  const quotedQueryMatch = text.match(/["']([^"']+)["']/);
  if (quotedQueryMatch && quotedQueryMatch[1]) {
    // Return just the content inside the quotes
    return quotedQueryMatch[1].trim();
  }

  // Check for common patterns where the query is preceded by explanatory text
  const patternMatches = [
    // Match "Here is the converted query:" pattern
    text.match(/here is the (converted|enhanced) query:?\s*["']?([^"']+)["']?/i),
    // Match "The search query is:" pattern
    text.match(/the (search query|query) (is|would be):?\s*["']?([^"']+)["']?/i),
    // Match "I've converted your query to:" pattern
    text.match(/i('ve| have) converted your query to:?\s*["']?([^"']+)["']?/i),
    // Match "Converting to:" pattern
    text.match(/converting to:?\s*["']?([^"']+)["']?/i),
  ].filter(Boolean);

  if (patternMatches.length > 0 && patternMatches[0]) {
    // Return the captured query part (last capture group)
    const match = patternMatches[0];

    if (!match[match.length - 1]) return;

    return match[match.length - 1]!.trim();
  }

  // If no patterns match, remove common explanatory text and return
  let cleanedText = text
    // Remove "I focused on..." explanations
    .replace(/I focused on.*$/im, '')
    // Remove "Here's a precise..." explanations
    .replace(/Here's a precise.*$/im, '')
    // Remove any explanations after the query
    .replace(/\n\nThis (query|search).*$/im, '')
    // Remove any explanations before the query
    .replace(/^.*?(from:|to:|subject:|is:|has:|after:|before:)/i, '$1')
    // Clean up any remaining quotes
    .replace(/["']/g, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedText;
}
