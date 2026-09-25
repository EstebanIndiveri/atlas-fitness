import { expect, type Page } from '@playwright/test';

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const overflowingElements = Array.from(
      document.body.querySelectorAll<HTMLElement>('*'),
    )
      .flatMap((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.right <= clientWidth) {
          return [];
        }

        const round = (value: number): number => Math.round(value * 10) / 10;
        return [
          {
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            class: element.getAttribute('class'),
            testId: element.getAttribute('data-testid'),
            ariaLabel: element.getAttribute('aria-label'),
            rect: {
              x: round(rect.x),
              y: round(rect.y),
              width: round(rect.width),
              height: round(rect.height),
              top: round(rect.top),
              right: round(rect.right),
              bottom: round(rect.bottom),
              left: round(rect.left),
            },
          },
        ];
      })
      .sort((left, right) => right.rect.right - left.rect.right)
      .slice(0, 12);

    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth,
      overflowingElements,
    };
  });

  expect(
    layout.scrollWidth,
    `Unexpected horizontal overflow: ${JSON.stringify(layout)}`,
  ).toBeLessThanOrEqual(layout.clientWidth);
}
